from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..core.config import ROOT

router = APIRouter()
APK_PATH = ROOT / 'public_downloads' / 'SHK-Connect-latest.apk'


@router.api_route('/downloads/SHK-Connect-latest.apk', methods=['GET', 'HEAD'], include_in_schema=False)
def android_app():
    if not APK_PATH.is_file():
        raise HTTPException(status_code=404, detail='Android download is not available')
    return FileResponse(APK_PATH, media_type='application/vnd.android.package-archive',
                        filename='SHK-Connect-latest.apk',
                        headers={'Cache-Control': 'public, max-age=300'})
