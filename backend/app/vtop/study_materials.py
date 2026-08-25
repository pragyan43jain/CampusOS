"""
VHelpCC Study Material Service for CampusOS backend.
Landing URL: https://www.vhelpcc.com/study-material
"""

from typing import Optional

VHELP_STUDY_MATERIAL_URL = "https://www.vhelpcc.com/study-material"


def get_vhelp_study_material_url(code: Optional[str] = None, title: Optional[str] = None, course_type: Optional[str] = None) -> str:
    return VHELP_STUDY_MATERIAL_URL
