import type {SupportTurn} from "./supportContinuityServer";
export function collectSupportExport(readPage:(before?:string)=>Promise<SupportTurn[]>,options?:{maxRows?:number}):Promise<SupportTurn[]>;
