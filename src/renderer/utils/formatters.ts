/**
 * Formate un montant en entiers CFA (sans décimales)
 * @param amount - Le montant à formater
 * @param currency - La devise (par défaut "FCFA")
 * @returns Le montant formaté (ex: "59 003 FCFA")
 */
export const formatCurrency = (amount: number | string, currency: string = 'FCFA'): string => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) {
    return `0 ${currency}`;
  }

  const rounded = Math.round(numericAmount);

  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(rounded);

  return `${formatted} ${currency}`;
};

/**
 * Formate un nombre sans devise
 * @param value - Le nombre à formater
 * @returns Le nombre formaté (ex: "59 003")
 */
export const formatNumber = (value: number | string): string => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numericValue)) {
    return '0';
  }

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(Math.round(numericValue));
};
