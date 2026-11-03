// Memphis Senior Care Homes lead backend (senior-living vertical). Logic: lib/senior/handlers.mjs.
// Double opt-in: a new lead is routed only after this link is confirmed (GET shows the button, POST confirms).
// Answers 404 on every Pages project without the SENIOR_DB binding.
import seat from "../../data/senior_seat.json";
import zipDoc from "../../assets/senior-zips.json";
import * as H from "../../lib/senior/handlers.mjs";

const deps = () => ({ seat, zips: zipDoc.zips });

export const onRequestGet = (context) => H.handleConfirm(context, deps());
export const onRequestPost = (context) => H.handleConfirm(context, deps());
