// pdf-parse ships no types. This is a minimal ambient declaration covering
// the one function this app actually calls (see src/lib/ai/extractText.ts).
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages: number;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
