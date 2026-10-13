// Memphis Senior Care Homes lead backend (senior-living vertical). Logic: lib/senior/funnel.mjs.
// Answers 404 on every Pages project without the SENIOR_DB binding.
import seat from "../../data/senior_seat.json";
import zipDoc from "../../assets/senior-zips.json";
import * as H from "../../lib/senior/funnel.mjs";

const deps = () => ({ seat, zips: zipDoc.zips });

export const onRequestGet = (context) => H.handleFunnel(context, deps());
