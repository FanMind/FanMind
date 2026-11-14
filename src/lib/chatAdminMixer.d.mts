export type MixerControl={enabled:boolean;intensity:number};
export type CharacterMixer={version:1;proposed?:boolean;personality:Record<string,MixerControl>;initiative:Record<string,MixerControl>;style:Record<string,MixerControl>;sales:Record<string,MixerControl>;custom:Array<MixerControl&{name:string}>};
export const MIXER_GROUPS:Readonly<Record<'personality'|'initiative'|'style'|'sales',string[][]>>;
export function emptyCharacterMixer():CharacterMixer;
export function normalizeCharacterMixer(value:unknown):CharacterMixer;
export function mixerControl(value:CharacterMixer,group:string,key:string):MixerControl;
export function setMixerControl(value:CharacterMixer,group:string,key:string,control:MixerControl):CharacterMixer;
export function characterMixerContext(value:unknown):Record<string,unknown>|null;
