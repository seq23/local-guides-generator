// Memphis Senior Care Homes lead backend (senior-living vertical). Logic: lib/senior/handlers.mjs.
// Answers 404 on every Pages project without the SENIOR_DB binding.
import seat from "../../data/senior_seat.json";
import zipDoc from "../../assets/senior-zips.json";
import * as H from "../../lib/senior/handlers.mjs";

const deps = () => ({ seat, zips: zipDoc.zips });

export const onRequestPost = (context) => H.handleTick(context, deps());
