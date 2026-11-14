"use client";
import {useState} from "react";
import {SupportAIConsentControl} from "@/components/SupportAIConsentControl";
export function SupportConsentSettings({scope}:{scope:string}){
 const [value,setValue]=useState(false);
 return <SupportAIConsentControl accountSettings scope={scope} legacyValue={value} onValue={setValue}/>;
}
