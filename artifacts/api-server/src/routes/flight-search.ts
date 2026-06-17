import { Router } from "express";
import { XMLParser } from "fast-xml-parser";
import { getFlightCredentials, getTravelportPcc } from "../lib/credentials";

const router = Router();

const TRAVELPORT_ENDPOINT =
  "https://emea.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService";

export interface FlightSegment {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabinClass: string;
}

export interface FlightOption {
  key: string;
  totalPrice: string;
  currency: string;
  basePrice: string;
  taxes: string;
  segments: FlightSegment[];
  stops: number;
  totalDuration: string;
  bookingCode: string;
}

function buildSoapEnvelope(
  fromCode: string,
  toCode: string,
  depDate: string,
  retDate: string | undefined,
  adults: number,
  pcc: string,
): string {
  const returnLeg = retDate
    ? `<air:SearchAirLeg>
        <air:SearchOrigin><com:CityOrAirport Code="${toCode}"/></air:SearchOrigin>
        <air:SearchDestination><com:CityOrAirport Code="${fromCode}"/></air:SearchDestination>
        <air:SearchDepTime PreferredTime="${retDate}"/>
      </air:SearchAirLeg>`
    : "";

  const passengerEls = Array.from({ length: adults }, (_, i) =>
    `<com:SearchPassenger Code="ADT" BookingTravelerRef="ref${i + 1}"/>`,
  ).join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:com="http://www.travelport.com/schema/common_v52_0"
  xmlns:air="http://www.travelport.com/schema/air_v52_0">
  <soapenv:Header/>
  <soapenv:Body>
    <air:LowFareSearchReq
      TargetBranch="${pcc}"
      TraceId="dtours-${Date.now()}"
      AuthorizedBy="DT"
      xmlns:air="http://www.travelport.com/schema/air_v52_0"
      xmlns:com="http://www.travelport.com/schema/common_v52_0">
      <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
      <air:SearchAirLeg>
        <air:SearchOrigin><com:CityOrAirport Code="${fromCode}"/></air:SearchOrigin>
        <air:SearchDestination><com:CityOrAirport Code="${toCode}"/></air:SearchDestination>
        <air:SearchDepTime PreferredTime="${depDate}"/>
      </air:SearchAirLeg>
      ${returnLeg}
      <air:AirSearchModifiers MaxSolutions="20">
        <air:PreferredCabins>
          <air:CabinClass Type="Economy"/>
        </air:PreferredCabins>
      </air:AirSearchModifiers>
      ${passengerEls}
    </air:LowFareSearchReq>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseTime(iso: string): string {
  if (!iso) return "";
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t ? t.substring(0, 5) : iso;
}

function parseDuration(pts: string): string {
  if (!pts) return "";
  const h = pts.match(/(\d+)H/)?.[1];
  const m = pts.match(/(\d+)M/)?.[1];
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return pts;
}

function parseFlightResults(xmlStr: string): FlightOption[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });

  const doc = parser.parse(xmlStr);
  const body = doc?.["Envelope"]?.["Body"] ?? doc?.["SOAP-ENV:Envelope"]?.["SOAP-ENV:Body"] ?? {};

  const searchResp =
    body?.["LowFareSearchRsp"] ??
    body?.["LowFareSearchResponse"] ??
    {};

  const airPriceSolutions = searchResp?.["AirPricingSolution"] ?? [];
  const solutions = Array.isArray(airPriceSolutions)
    ? airPriceSolutions
    : [airPriceSolutions];

  const airSegmentMap: Record<string, FlightSegment> = {};

  const rawSegments = searchResp?.["AirSegmentList"]?.["AirSegment"] ??
    searchResp?.["AirSegment"] ?? [];
  const segArr = Array.isArray(rawSegments) ? rawSegments : [rawSegments];
  for (const seg of segArr) {
    if (!seg || !seg["@_Key"]) continue;
    airSegmentMap[seg["@_Key"]] = {
      carrier: seg["@_Carrier"] ?? seg["@_OperatingCarrier"] ?? "",
      flightNumber: seg["@_FlightNumber"] ?? "",
      origin: seg["@_Origin"] ?? "",
      destination: seg["@_Destination"] ?? "",
      departureTime: parseTime(seg["@_DepartureTime"] ?? ""),
      arrivalTime: parseTime(seg["@_ArrivalTime"] ?? ""),
      duration: parseDuration(seg["@_FlightTime"] ?? seg["@_TravelTime"] ?? ""),
      cabinClass: "Economy",
    };
  }

  const results: FlightOption[] = [];

  for (const sol of solutions.slice(0, 10)) {
    if (!sol) continue;

    const totalPrice = sol["@_TotalPrice"] ?? "";
    const basePrice = sol["@_BasePrice"] ?? "";
    const taxes = sol["@_Taxes"] ?? "";
    const currency = totalPrice.replace(/[0-9.]/g, "") || "KWD";
    const priceNum = totalPrice.replace(/[^0-9.]/g, "");

    const journeys = sol?.["AirPricingInfo"]?.["FlightOptionsList"]?.["FlightOption"] ??
      sol?.["Journey"] ?? [];
    const journeyArr = Array.isArray(journeys) ? journeys : [journeys];

    const segments: FlightSegment[] = [];
    let totalDuration = "";

    for (const journey of journeyArr) {
      if (!journey) continue;
      const option = journey?.["Option"] ?? journey;
      const optArr = Array.isArray(option) ? option[0] : option;
      const segRefs = optArr?.["BookingInfo"] ?? optArr?.["SegmentRef"] ?? optArr?.["AirSegmentRef"] ?? [];
      const segRefArr = Array.isArray(segRefs) ? segRefs : [segRefs];

      for (const ref of segRefArr) {
        const key = ref?.["@_SegmentRef"] ?? ref?.["@_Key"] ?? ref;
        if (key && airSegmentMap[key]) {
          segments.push(airSegmentMap[key]);
        }
      }

      if (!totalDuration && optArr?.["@_TravelTime"]) {
        totalDuration = parseDuration(optArr["@_TravelTime"]);
      }
    }

    if (segments.length === 0 && Object.keys(airSegmentMap).length === 0) {
      const directSegs = sol?.["AirSegment"] ?? [];
      const dArr = Array.isArray(directSegs) ? directSegs : [directSegs];
      for (const s of dArr) {
        if (s?.["@_Key"]) {
          segments.push({
            carrier: s["@_Carrier"] ?? "",
            flightNumber: s["@_FlightNumber"] ?? "",
            origin: s["@_Origin"] ?? "",
            destination: s["@_Destination"] ?? "",
            departureTime: parseTime(s["@_DepartureTime"] ?? ""),
            arrivalTime: parseTime(s["@_ArrivalTime"] ?? ""),
            duration: parseDuration(s["@_FlightTime"] ?? ""),
            cabinClass: "Economy",
          });
        }
      }
    }

    results.push({
      key: sol["@_Key"] ?? String(results.length),
      totalPrice: priceNum,
      currency,
      basePrice: basePrice.replace(/[^0-9.]/g, ""),
      taxes: taxes.replace(/[^0-9.]/g, ""),
      segments,
      stops: Math.max(0, segments.length - 1),
      totalDuration,
      bookingCode: sol?.["AirPricingInfo"]?.["@_PlatingCarrier"] ?? segments[0]?.carrier ?? "",
    });
  }

  return results;
}

router.post("/flight-search", async (req, res) => {
  const { from, to, depDate, retDate, adults = 1 } = req.body as {
    from: string;
    to: string;
    depDate: string;
    retDate?: string;
    adults?: number;
  };

  if (!from || !to || !depDate) {
    res.status(400).json({ ok: false, error: "from, to, and depDate are required" });
    return;
  }

  const pcc = getTravelportPcc();
  if (!pcc) {
    res.status(503).json({
      ok: false,
      error: "Flight API not configured — TRAVELPORT_PCC missing",
      code: "NO_PCC",
    });
    return;
  }

  const { username, password } = getFlightCredentials();
  if (!username || !password) {
    res.status(503).json({
      ok: false,
      error: "Flight API credentials not configured",
      code: "NO_CREDENTIALS",
    });
    return;
  }

  const soapBody = buildSoapEnvelope(
    from.toUpperCase(),
    to.toUpperCase(),
    depDate,
    retDate || undefined,
    Math.max(1, Math.min(9, Number(adults))),
    pcc,
  );

  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(TRAVELPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        Authorization: `Basic ${basicAuth}`,
        SOAPAction: '""',
      },
      body: soapBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const xmlText = await response.text();

    if (!response.ok || xmlText.includes("faultcode")) {
      const faultMatch = xmlText.match(/<[^:>]*faultstring[^>]*>([^<]+)<\//);
      const faultCode = xmlText.match(/<[^:>]*faultcode[^>]*>([^<]+)<\//)?.[1] ?? "";
      const msg = faultMatch?.[1] ?? `HTTP ${response.status}`;
      req.log.warn({ faultCode, msg }, "Travelport SOAP fault");
      res.status(502).json({
        ok: false,
        error: msg,
        code: faultCode,
      });
      return;
    }

    const flights = parseFlightResults(xmlText);

    res.json({ ok: true, flights, count: flights.length });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    req.log.error({ err }, "Travelport search failed");
    res.status(isTimeout ? 504 : 502).json({
      ok: false,
      error: isTimeout ? "Flight search timed out" : "Flight search failed",
    });
  }
});

router.get("/flight-search/status", (_req, res) => {
  const pcc = getTravelportPcc();
  const { username } = getFlightCredentials();
  res.json({
    configured: !!(pcc && username),
    hasCredentials: !!username,
    hasPcc: !!pcc,
  });
});

export default router;
