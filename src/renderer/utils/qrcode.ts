import QRCode from "qrcode";

interface QRInvoiceData {
  numero: string;
  date: string;
  client: string;
  totalAchat: number;
  remise: number;
  tva: number;
  totalTTC: number;
  devise?: string;
}

export async function generateInvoiceQR(data: QRInvoiceData): Promise<string> {
  const text = [
    `Facture N° ${data.numero}`,
    `Date: ${data.date}`,
    `Client: ${data.client}`,
    `Total achat: ${data.totalAchat.toLocaleString("fr-FR")}${data.devise ? " " + data.devise : ""}`,
    `Remise: ${data.remise.toLocaleString("fr-FR")}${data.devise ? " " + data.devise : ""}`,
    `TVA: ${data.tva.toLocaleString("fr-FR")}${data.devise ? " " + data.devise : ""}`,
    `TTC: ${data.totalTTC.toLocaleString("fr-FR")}${data.devise ? " " + data.devise : ""}`,
  ].join("\n");

  const dataUrl = await QRCode.toDataURL(text, {
    width: 150,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });

  return dataUrl;
}
