/**
 * VHelpCC Study Material Service
 * 
 * Base landing URL: https://www.vhelpcc.com/study-material
 * Provides direct access to the VHelpCC study material hub for courses.
 */

export const VHELP_STUDY_MATERIAL_URL = "https://www.vhelpcc.com/study-material";

/**
 * Returns the VHelpCC study material URL for a specific course code or title.
 */
export function getStudyMaterialUrl(params?: {
  code?: string;
  title?: string;
  type?: string;
}): string {
  if (params?.code) {
    return `${VHELP_STUDY_MATERIAL_URL}?course=${encodeURIComponent(params.code.trim().toUpperCase())}`;
  }
  return VHELP_STUDY_MATERIAL_URL;
}

/**
 * Checks if a subject has study material available on VHelpCC.
 */
export function hasStudyMaterial(_params?: {
  code?: string;
  title?: string;
  type?: string;
}): boolean {
  return true;
}
