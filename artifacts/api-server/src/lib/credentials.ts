const INVISIBLE_CHARS = /[\u200b\u200c\u200d\ufeff\u00a0\u0000-\u001f]/g;

function cleanEnv(name: string): string {
  const raw = process.env[name] ?? "";
  return raw.replace(INVISIBLE_CHARS, "").trim();
}

export function getFlightCredentials(): { username: string; password: string } {
  return {
    username: cleanEnv("FLIGHT_API_USER"),
    password: cleanEnv("FLIGHT_API_PASS"),
  };
}

export function getHotelCredentials(): { apiKey: string; secret: string } {
  return {
    apiKey: cleanEnv("HOTEL_API_USER"),
    secret: cleanEnv("HOTEL_API_PASS"),
  };
}

export function getTravelportPcc(): string {
  return cleanEnv("TRAVELPORT_PCC");
}
