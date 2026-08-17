import { Occurrence, Suspect } from "../types";

/**
 * Remove acentos, caracteres especiais e converte para minúsculas
 */
export const normalizeSearchText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Extrai apenas dígitos numéricos de um texto
 */
export const extractDigits = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.toString().replace(/\D/g, "");
};

/**
 * Mapeia os termos de status para termos em português pesquisáveis
 */
const getStatusSearchKeywords = (status?: string, foragido?: boolean, alvoEmFoco?: boolean): string => {
  const words: string[] = [];

  if (foragido) {
    words.push("foragido", "mandado", "evadido", "fuga", "mandado de prisao", "procurado");
  }

  if (alvoEmFoco) {
    words.push("alvo", "alvo em foco", "foco", "prioritario", "monitorado", "mural de alvos");
  }

  switch (status) {
    case "wanted":
      words.push("procurado", "mandado", "foragido", "em aberto");
      break;
    case "arrested":
      words.push("preso", "detido", "recluso", "cadeia", "sistema prisional", "custodia");
      break;
    case "investigating":
      words.push("investigado", "investigacao", "em investigacao", "inquerito", "suspeito");
      break;
    case "inactive":
      words.push("inativo", "arquivado", "sem ocorrencias ativas");
      break;
    default:
      break;
  }

  return words.join(" ");
};

/**
 * Constrói um corpus unificado e inteligente com todas as informações pesquisáveis do suspeito
 */
export const buildSuspectSearchCorpus = (
  suspect: Suspect,
  occurrences: Occurrence[] = []
): { textCorpus: string; digitsCorpus: string } => {
  // Ocorrências associadas a este suspeito
  const relatedOccs = occurrences.filter((occ) => {
    if (occ.relatedSuspects && Array.isArray(occ.relatedSuspects) && occ.relatedSuspects.includes(suspect.id)) {
      return true;
    }
    if (occ.envolvidoName && suspect.name && occ.envolvidoName.toLowerCase().trim() === suspect.name.toLowerCase().trim()) {
      return true;
    }
    if (occ.vulgo && suspect.alias && occ.vulgo.toLowerCase().trim() === suspect.alias.toLowerCase().trim()) {
      return true;
    }
    return false;
  });

  const occurrencesText = relatedOccs
    .map(
      (occ) =>
        `${occ.id} ${occ.title || ""} ${occ.description || ""} ${occ.location || ""} ${occ.date || ""} ${occ.time || ""} ${occ.agentInCharge || ""}`
    )
    .join(" ");

  // Histórico de fotos e abordagens
  const photoHistoryText = Array.isArray(suspect.photoHistory)
    ? suspect.photoHistory
        .map((p) => `${p.description || ""} ${p.agentName || ""} ${p.date || ""}`)
        .join(" ")
    : "";

  // Data formatada de cadastro e nascimento
  let formattedDates = "";
  if (suspect.createdAt) {
    try {
      const d = new Date(suspect.createdAt);
      formattedDates += ` ${d.toLocaleDateString("pt-BR")} ${d.getFullYear()} ${d.toISOString().slice(0, 10)}`;
    } catch {
      // ignore
    }
  }

  if (suspect.birthDate) {
    formattedDates += ` ${suspect.birthDate}`;
    try {
      const bDate = new Date(suspect.birthDate);
      if (!isNaN(bDate.getTime())) {
        formattedDates += ` ${bDate.toLocaleDateString("pt-BR")} ${bDate.getFullYear()}`;
        // Idade
        const age = new Date().getFullYear() - bDate.getFullYear();
        if (age > 0 && age < 120) {
          formattedDates += ` ${age} anos idade ${age}`;
        }
      }
    } catch {
      // ignore
    }
  }

  const statusKeywords = getStatusSearchKeywords(suspect.status, suspect.foragido, suspect.alvoEmFoco);

  const rawCorpus = [
    suspect.id,
    suspect.name,
    suspect.alias,
    suspect.document,
    suspect.motherName,
    suspect.faction,
    suspect.municipio,
    suspect.areaOfOperation,
    suspect.lastKnownAddress,
    suspect.antecedentes,
    suspect.frequentCrimes,
    suspect.observations,
    suspect.alvoEmFocoReason,
    suspect.mandadoNumero,
    suspect.tattoosScars,
    suspect.height,
    suspect.weight,
    suspect.skinColor,
    suspect.eyeColor,
    suspect.hairType,
    statusKeywords,
    formattedDates,
    photoHistoryText,
    occurrencesText,
  ]
    .filter(Boolean)
    .join(" ");

  const textCorpus = normalizeSearchText(rawCorpus);

  // Extrai dígitos numéricos relevantes (Documento, Mandado, ID, Ocorrências)
  const digitsCorpus = extractDigits(
    `${suspect.document || ""} ${suspect.mandadoNumero || ""} ${suspect.id || ""} ${formattedDates}`
  );

  return { textCorpus, digitsCorpus };
};

/**
 * Função de Pesquisa Inteligente Multi-Campos:
 * - Suporta múltiplos termos na mesma busca (ex: "cv lajeado homicidio", "tatuagem carpa roubo")
 * - Insensível a maiúsculas/minúsculas e acentuação (ex: "facção" e "faccao")
 * - Busca dígitos de documentos sem pontuação (ex: "123456" acha "123.456-78")
 * - Varre todos os campos cadastrais, observações, mandados, histórico e ocorrências vinculadas
 */
export const matchesSuspectSmartSearch = (
  suspect: Suspect,
  query: string,
  occurrences: Occurrence[] = []
): boolean => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  const { textCorpus, digitsCorpus } = buildSuspectSearchCorpus(suspect, occurrences);

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTerms.length === 0) return true;

  // Verifica se todos os termos da busca estão presentes em qualquer parte da ficha
  return queryTerms.every((term) => {
    // 1. Casamento direto no texto normalizado
    if (textCorpus.includes(term)) {
      return true;
    }

    // 2. Se o termo contém dígitos (ex: busca por parte de CPF/RG/Mandado/Ano)
    const termDigits = extractDigits(term);
    if (termDigits.length >= 2 && digitsCorpus.includes(termDigits)) {
      return true;
    }

    return false;
  });
};

/**
 * Pesquisa Inteligente para Ocorrências Policiais
 */
export const matchesOccurrenceSmartSearch = (
  occ: Occurrence,
  query: string,
  suspects: Suspect[] = []
): boolean => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) return true;

  // Suspeitos vinculados
  const relatedSuspectsList = suspects.filter((s) => occ.relatedSuspects?.includes(s.id));
  const relatedSuspectsText = relatedSuspectsList
    .map((s) => `${s.name} ${s.alias} ${s.document} ${s.faction || ""} ${s.municipio || ""}`)
    .join(" ");

  // Pessoas envolvidas adicionais
  const involvedText = Array.isArray(occ.involvedPeople)
    ? occ.involvedPeople
        .map((p) => `${p.name || ""} ${p.vulgo || ""} ${p.document || ""}`)
        .join(" ")
    : "";

  const rawCorpus = [
    occ.id,
    occ.title,
    occ.description,
    occ.location,
    occ.date,
    occ.time,
    occ.agentInCharge,
    occ.envolvidoName,
    occ.vulgo,
    occ.severity,
    occ.status,
    involvedText,
    relatedSuspectsText,
  ]
    .filter(Boolean)
    .join(" ");

  const textCorpus = normalizeSearchText(rawCorpus);
  const digitsCorpus = extractDigits(rawCorpus);

  return queryTerms.every((term) => {
    if (textCorpus.includes(term)) return true;
    const termDigits = extractDigits(term);
    if (termDigits.length >= 2 && digitsCorpus.includes(termDigits)) return true;
    return false;
  });
};

/**
 * Calcula a distância de Levenshtein entre duas strings para tolerância a pequenos erros de digitação
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

export interface SuspectDuplicateMatch {
  suspect: Suspect;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  primaryReason: string;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  highestConfidence: "high" | "medium" | "low" | null;
  matches: SuspectDuplicateMatch[];
}

/**
 * Inteligência de Detecção de Duplicidades e Homônimos no Banco de Dados
 * Identifica se a pessoa já possui cadastro por:
 * 1. Documento idêntico (CPF, RG, Prontuário)
 * 2. Nome completo idêntico ou com pequenas variações fonéticas/digitação
 * 3. Nome da mãe idêntico + primeiro nome
 * 4. Vulgo idêntico + primeiro/último nome
 */
export const checkSuspectDuplicates = (
  candidate: {
    name?: string;
    document?: string;
    alias?: string;
    motherName?: string;
    birthDate?: string;
    mandadoNumero?: string;
  },
  existingSuspects: Suspect[],
  currentSuspectId?: string
): DuplicateCheckResult => {
  const normCandidateName = normalizeSearchText(candidate.name);
  const candDocDigits = extractDigits(candidate.document);
  const candDocNorm = normalizeSearchText(candidate.document);
  const normCandidateAlias = normalizeSearchText(candidate.alias);
  const normCandidateMother = normalizeSearchText(candidate.motherName);
  const candMandadoDigits = extractDigits(candidate.mandadoNumero);

  const candidateTokens = normCandidateName
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["dos", "das", "del", "filho", "junior", "neto", "sobrinho"].includes(t));

  const matches: SuspectDuplicateMatch[] = [];

  for (const s of existingSuspects) {
    if (currentSuspectId && s.id === currentSuspectId) {
      continue; // Ignora o próprio suspeito em caso de edição
    }

    const sNormName = normalizeSearchText(s.name);
    const sDocDigits = extractDigits(s.document);
    const sDocNorm = normalizeSearchText(s.document);
    const sNormAlias = normalizeSearchText(s.alias);
    const sNormMother = normalizeSearchText(s.motherName);
    const sMandadoDigits = extractDigits(s.mandadoNumero);

    const sTokens = sNormName
      .split(/\s+/)
      .filter((t) => t.length > 2 && !["dos", "das", "del", "filho", "junior", "neto", "sobrinho"].includes(t));

    const reasons: string[] = [];
    let confidence: "high" | "medium" | "low" = "low";

    const elevateConfidence = (level: "high" | "medium" | "low") => {
      const scoreMap = { high: 3, medium: 2, low: 1 };
      if (scoreMap[level] > scoreMap[confidence]) {
        confidence = level;
      }
    };

    // 1. VERIFICAÇÃO POR DOCUMENTO (CPF / RG / PRONTUÁRIO)
    if (candDocDigits.length >= 6 && sDocDigits.length >= 6) {
      if (candDocDigits === sDocDigits) {
        reasons.push(`Documento/CPF idêntico (${candidate.document})`);
        elevateConfidence("high");
      } else if (candDocDigits.includes(sDocDigits) || sDocDigits.includes(candDocDigits)) {
        reasons.push(`Numeração de documento coincidente (${s.document})`);
        elevateConfidence("medium");
      }
    } else if (candDocNorm.length >= 5 && sDocNorm.length >= 5 && candDocNorm === sDocNorm) {
      reasons.push(`Documento idêntico (${candidate.document})`);
      elevateConfidence("high");
    }

    // 2. VERIFICAÇÃO POR MANDADO DE PRISÃO
    if (candMandadoDigits.length >= 6 && sMandadoDigits.length >= 6 && candMandadoDigits === sMandadoDigits) {
      reasons.push(`Mesmo número de Mandado de Prisão (${candidate.mandadoNumero})`);
      elevateConfidence("high");
    }

    // 3. VERIFICAÇÃO POR NOME EXATO
    if (normCandidateName.length >= 4 && sNormName.length >= 4) {
      if (normCandidateName === sNormName) {
        reasons.push("Nome completo exatamente igual");
        elevateConfidence("high");
      } else {
        // Levenshtein para pegar pequenos erros de digitação (ex: "Matheus" vs "Mateus")
        const dist = levenshteinDistance(normCandidateName, sNormName);
        const maxLen = Math.max(normCandidateName.length, sNormName.length);
        if (dist <= 2 && maxLen >= 8) {
          reasons.push(`Grafia do nome quase idêntica (diferença de ${dist} caractere${dist > 1 ? "s" : ""})`);
          elevateConfidence("high");
        } else if (dist <= 3 && maxLen >= 12) {
          reasons.push(`Grafia do nome muito semelhante`);
          elevateConfidence("medium");
        }
      }
    }

    // 4. VERIFICAÇÃO POR SOBRENOME E NOMES COMPOSTOS (TOKENS)
    if (candidateTokens.length >= 2 && sTokens.length >= 2) {
      const commonTokens = candidateTokens.filter((t) => sTokens.includes(t));
      const overlapRatio = commonTokens.length / Math.min(candidateTokens.length, sTokens.length);

      if (overlapRatio === 1 && candidateTokens.length !== sTokens.length) {
        reasons.push(`Nomes coincidentes (${commonTokens.join(" ")})`);
        elevateConfidence("medium");
      } else if (commonTokens.length >= 3) {
        reasons.push(`3 ou mais partes do nome coincidem (${commonTokens.join(", ")})`);
        elevateConfidence("medium");
      }
    }

    // 5. VERIFICAÇÃO POR NOME DA MÃE
    if (normCandidateMother.length >= 5 && sNormMother.length >= 5) {
      if (normCandidateMother === sNormMother) {
        const firstCandToken = candidateTokens[0] || "";
        const firstSToken = sTokens[0] || "";
        if (firstCandToken && firstSToken && firstCandToken === firstSToken) {
          reasons.push(`Mesmo primeiro nome (${firstCandToken}) e mesmo nome de mãe (${candidate.motherName})`);
          elevateConfidence("high");
        } else {
          reasons.push(`Mesmo nome de mãe registrado (${candidate.motherName})`);
          elevateConfidence("medium");
        }
      }
    }

    // 6. VERIFICAÇÃO POR VULGO (APELIDO) + PARTE DO NOME
    if (normCandidateAlias.length >= 3 && sNormAlias.length >= 3) {
      if (normCandidateAlias === sNormAlias) {
        const firstCandToken = candidateTokens[0] || "";
        const firstSToken = sTokens[0] || "";
        if (firstCandToken && firstSToken && firstCandToken === firstSToken) {
          reasons.push(`Mesmo vulgo ("${candidate.alias}") e primeiro nome ("${firstCandToken}")`);
          elevateConfidence("high");
        } else {
          reasons.push(`Mesmo vulgo ("${candidate.alias}")`);
          elevateConfidence("low");
        }
      }
    }

    // 7. VERIFICAÇÃO POR DATA DE NASCIMENTO + PRIMEIRO E ÚLTIMO NOME
    if (candidate.birthDate && s.birthDate && candidate.birthDate === s.birthDate) {
      if (candidateTokens.length >= 2 && sTokens.length >= 2) {
        if (candidateTokens[0] === sTokens[0] && candidateTokens[candidateTokens.length - 1] === sTokens[sTokens.length - 1]) {
          reasons.push(`Mesma data de nascimento (${candidate.birthDate}) e nomes coincidentes`);
          elevateConfidence("high");
        }
      }
    }

    if (reasons.length > 0) {
      matches.push({
        suspect: s,
        confidence,
        reasons,
        primaryReason: reasons[0],
      });
    }
  }

  // Ordena os matches pela maior confiança e número de motivos
  matches.sort((a, b) => {
    const confScore = { high: 3, medium: 2, low: 1 };
    const diff = confScore[b.confidence] - confScore[a.confidence];
    if (diff !== 0) return diff;
    return b.reasons.length - a.reasons.length;
  });

  const highestConfidence = matches.length > 0 ? matches[0].confidence : null;

  return {
    hasDuplicate: matches.length > 0,
    highestConfidence,
    matches,
  };
};

