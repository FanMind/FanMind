const markerPattern=/^[0-9a-f]{32}$/u;

const offers=(values)=>Object.freeze([
  Object.freeze({id:"photo",name:"Foto",category:"photo",...values.photo}),
  Object.freeze({id:"video",name:"Video",category:"video",...values.video}),
  Object.freeze({id:"private_photo",name:"Privates Foto",category:"private_photo",...values.privatePhoto}),
  Object.freeze({id:"private_video",name:"Privates Video",category:"private_video",...values.privateVideo}),
]);

export const CHAT_ADMIN_ACCEPTANCE_OFFERS=Object.freeze({
  a:offers({
    photo:{currency:"EUR",minimumPriceMinor:1100,recommendedPriceMinor:1200,maximumPriceMinor:1300},
    video:{currency:"CHF",minimumPriceMinor:2100,recommendedPriceMinor:2200,maximumPriceMinor:2300},
    privatePhoto:{currency:"USD",minimumPriceMinor:3100,recommendedPriceMinor:3200,maximumPriceMinor:3300},
    privateVideo:{currency:"GBP",minimumPriceMinor:4100,recommendedPriceMinor:4200,maximumPriceMinor:4300},
  }),
  b:offers({
    photo:{currency:"GBP",minimumPriceMinor:5100,recommendedPriceMinor:5200,maximumPriceMinor:5300},
    video:{currency:"USD",minimumPriceMinor:6100,recommendedPriceMinor:6200,maximumPriceMinor:6300},
    privatePhoto:{currency:"CHF",minimumPriceMinor:7100,recommendedPriceMinor:7200,maximumPriceMinor:7300},
    privateVideo:{currency:"EUR",minimumPriceMinor:8100,recommendedPriceMinor:8200,maximumPriceMinor:8300},
  }),
});

export const CHAT_ADMIN_ACCEPTANCE_REQUESTS=Object.freeze({
  a:"Was kostet dein Video?",
  b:"Was kostet dein privates Video?",
  noOffer:"Wie war dein Tag heute?",
});

export function chatAdminAcceptanceFanName(persona,marker){
  if(!["A","B"].includes(persona)||!markerPattern.test(marker??""))throw Error("chat_admin_manual_fixture_marker");
  return `FM Synthetic Fan ${persona} ${marker}`;
}

export function chatAdminAcceptancePriceValue(minor){
  if(!Number.isInteger(minor)||minor<1)throw Error("chat_admin_manual_fixture_price");
  return (minor/100).toFixed(2);
}
