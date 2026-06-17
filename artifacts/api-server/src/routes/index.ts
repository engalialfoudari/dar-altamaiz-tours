import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import tickerRouter from "./ticker";
import chatRouter from "./chat";
import chatWidgetRouter from "./chat-widget";
import searchRouter from "./search";
import chatSummaryRouter from "./chat-summary";
import flightRedirectRouter from "./flight-redirect";
import flightSearchRouter from "./flight-search";
import flightScrapeRouter from "./flight-scrape";
import flightPrepareRouter from "./flight-prepare";
import hotelSearchRouter from "./hotel-search";
import offersRouter from "./offers";
import debugScrapeRouter from "./debug-scrape";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requestsRouter);
router.use(tickerRouter);
router.use(chatRouter);
router.use(chatWidgetRouter);
router.use(searchRouter);
router.use(chatSummaryRouter);
router.use(flightRedirectRouter);
router.use(flightSearchRouter);
router.use(flightScrapeRouter);
router.use(flightPrepareRouter);
router.use(hotelSearchRouter);
router.use(offersRouter);
router.use(debugScrapeRouter);

export default router;
