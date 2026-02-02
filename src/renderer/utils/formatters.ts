/**
 * Formate un montant en respectant le format français
 * @param amount - Le montant à formater
 * @param currency - La devise (par défaut "FCFA")
 * @returns Le montant formaté (ex: "59 003,53 FCFA")
 */
export const formatCurrency = (amount: number | string, currency: string = 'FCFA'): string => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) {
    return `0,00 ${currency}`;
  }

  // Formatage avec espace pour les milliers et virgule pour les décimales
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);

  return `${formatted} ${currency}`;
};

/**
 * Formate un nombre sans devise
 * @param value - Le nombre à formater
 * @returns Le nombre formaté (ex: "59 003,53")
 */
export const formatNumber = (value: number | string): string => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numericValue)) {
    return '0,00';
  }

  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
};
