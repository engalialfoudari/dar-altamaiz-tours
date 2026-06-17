import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import tickerRouter from "./ticker";
import chatRouter from "./chat";
import chatWidgetRouter from "./chat-widget";
import searchRouter from "./search";
import chatSummaryRouter from "./chat-summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requestsRouter);
router.use(tickerRouter);
router.use(chatRouter);
router.use(chatWidgetRouter);
router.use(searchRouter);
router.use(chatSummaryRouter);

export default router;
