export function repairMojibake(text: string) {
  if (!/[ÃÂ]/.test(text)) return text;

  return text.replace(/(?:[ÃÂ][\u0080-\u00bf])+/g, (fragment) => {
    const bytes = Uint8Array.from(Array.from(fragment, (character) => character.charCodeAt(0)));
    const repaired = new TextDecoder("utf-8").decode(bytes);
    return repaired.includes("�") ? fragment : repaired;
  });
}
