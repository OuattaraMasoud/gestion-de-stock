/**
 * Convertit un nombre en lettres (français).
 * Ex: 1 250 → "mille deux cent cinquante"
 */

const unites = [
  "",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];

const dizaines = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante",
  "quatre-vingt",
  "quatre-vingt",
];

function convertirCentaines(n: number): string {
  if (n === 0) return "";

  if (n < 20) return unites[n];

  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;

    // Cas spéciaux pour 70-79 et 90-99
    if (d === 7 || d === 9) {
      const reste = n - (d - 1) * 10;
      if (reste === 0) {
        return d === 7 ? "soixante-dix" : "quatre-vingt-dix";
      }
      return (
        dizaines[d] + (reste === 1 && d === 7 ? " et " : "-") + unites[reste]
      );
    }

    if (u === 0) {
      return dizaines[d] + (d === 8 ? "s" : "");
    }

    if (u === 1 && d >= 2 && d <= 6) {
      return dizaines[d] + " et un";
    }

    return dizaines[d] + "-" + unites[u];
  }

  // 100-999
  const c = Math.floor(n / 100);
  const reste = n % 100;

  let result = "";
  if (c === 1) {
    result = "cent";
  } else {
    result = unites[c] + " cent";
  }

  if (reste === 0) {
    return c > 1 ? result + "s" : result;
  }

  return result + " " + convertirCentaines(reste);
}

function convertirNombre(n: number): string {
  if (n === 0) return "zéro";
  if (n < 0) return "moins " + convertirNombre(-n);

  let result = "";
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1_000);
  const centaines = n % 1_000;

  if (milliards > 0) {
    result +=
      convertirCentaines(milliards) +
      " milliard" +
      (milliards > 1 ? "s" : "") +
      " ";
  }

  if (millions > 0) {
    result +=
      convertirCentaines(millions) +
      " million" +
      (millions > 1 ? "s" : "") +
      " ";
  }

  if (milliers > 0) {
    if (milliers === 1) {
      result += "mille ";
    } else {
      result += convertirCentaines(milliers) + " mille ";
    }
  }

  if (centaines > 0) {
    result += convertirCentaines(centaines);
  }

  return result.trim();
}

/**
 * Convertit un montant en lettres avec la devise.
 * Ex: 1250.5, "FCFA" → "Mille deux cent cinquante FCFA"
 */
export function montantEnLettres(
  montant: number,
  devise: string = "FCFA",
): string {
  const partieEntiere = Math.floor(Math.abs(montant));
  const texte = convertirNombre(partieEntiere);
  // Mettre la première lettre en majuscule
  const texteMaj = texte.charAt(0).toUpperCase() + texte.slice(1);
  return `${texteMaj} ${devise}`;
}
