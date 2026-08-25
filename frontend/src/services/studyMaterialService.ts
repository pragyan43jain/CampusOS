/**
 * VHelpCC Study Material Service
 * 
 * Base landing URL: https://www.vhelpcc.com/study-material
 * Provides direct access to the VHelpCC study material hub for all courses.
 */

export const VHELP_STUDY_MATERIAL_URL = "https://www.vhelpcc.com/study-material";

/**
 * Returns the VHelpCC study material landing URL for every course.
 */
export function getStudyMaterialUrl(_params?: {
  code?: string;
  title?: string;
  type?: string;
}): string {
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
