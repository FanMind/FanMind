export function isChatAdminStorageObjectAbsent(response:Response):Promise<boolean>;
export function waitForChatAdminStorageObjectAbsent(
 probe:(signal:AbortSignal)=>Promise<Response>,
 options?:{budgetMs?:number;now?:()=>number;sleep?:(ms:number)=>Promise<void>},
):Promise<boolean>;
