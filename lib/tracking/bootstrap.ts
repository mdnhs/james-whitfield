import {
  CONSENT_COOKIE,
  CONSENT_DEFAULTS,
  DAY_MS,
  type ConsentPolicy,
} from "./consent"
import { GA4_ID, GTM_ID, validId } from "./ids"
import { COLLAPSE } from "./sanitize"

import { scriptJson } from "@/lib/seo/json-ld"

// docs/brief.md §12.3: the one inline script at the top of SiteFrame. It
// runs at parse time, before hydration and before GTM could ever load. Its
// cookie and sanitising rules mirror lib/tracking/{consent,sanitize}.ts;
// bootstrap.test.ts executes it against the same fixtures.
const BODY = `
var dl=w.dataLayer=w.dataLayer||[];
function gtag(){dl.push(arguments)}
w.gtag=w.gtag||gtag;
gtag("consent","default",C.defaults);
gtag("set","ads_data_redaction",true);
function hit(p,k,f){for(var i=0;i<C.collapse.length;i++){if(p.indexOf(C.collapse[i][0])===0)return C.collapse[i][k]}return f}
function clean(h){if(!h)return"";try{var u=new URL(h,w.location.href);return u.origin+hit(u.pathname,1,u.pathname)}catch(e){return""}}
var l=w.location;
dl.push({page:{location:clean(l.href),path:hit(l.pathname,1,l.pathname),title:hit(l.pathname,2,d.title),referrer:clean(d.referrer)}});
if(C.ga4)dl.push({ga4_measurement_id:C.ga4});
var s=null;
try{var m=d.cookie.match(new RegExp("(?:^|;\\\\s*)"+C.cookie+"=([^;]*)"));if(m&&m[1].length<=300){var v=JSON.parse(decodeURIComponent(m[1]));if(v&&typeof v==="object"&&typeof v.id==="string"&&v.id.length>0&&v.id.length<=64&&v.v===C.version&&typeof v.ts==="number"&&v.ts%1===0&&(v.a===0||v.a===1)&&(v.m===0||v.m===1)){var age=Date.now()-v.ts*1000;if(age>=-300000&&age<=C.maxAgeMs)s={analytics:v.a===1,marketing:v.m===1}}}}catch(e){}
w.__mkConsent=s;
var loaded=false;
w.__loadGtm=function(){if(loaded||!C.gtm)return;loaded=true;dl.push({"gtm.start":new Date().getTime(),event:"gtm.js"});var j=d.createElement("script");j.async=true;j.src="https://www.googletagmanager.com/gtm.js?id="+encodeURIComponent(C.gtm);d.head.appendChild(j)};
if(s){var g=function(on){return on?"granted":"denied"};gtag("consent","update",{analytics_storage:g(s.analytics),ad_storage:g(s.marketing),ad_user_data:g(s.marketing),ad_personalization:g(s.marketing)});if(s.analytics||s.marketing)w.__loadGtm()}
`

export function bootstrapScript(input: {
  gtmId: string | null
  ga4Id: string | null
  policy: ConsentPolicy
}): string {
  const config = {
    gtm: validId(GTM_ID, input.gtmId),
    ga4: validId(GA4_ID, input.ga4Id),
    version: input.policy.version,
    maxAgeMs: input.policy.months * 30 * DAY_MS,
    cookie: CONSENT_COOKIE,
    defaults: CONSENT_DEFAULTS,
    collapse: COLLAPSE,
  }
  // JSON.stringify with < > & U+2028/2029 escaped: nothing can close the
  // script tag or break the line.
  const json = scriptJson(config)
  return `(function(w,d){var C=${json};${BODY.replace(/\n/g, "")}})(window,document);`
}
