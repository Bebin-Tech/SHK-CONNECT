from backend.app.api import downloads


def test_public_apk_download_supports_phone_install_and_resume(client, tmp_path, monkeypatch):
    apk = tmp_path / 'SHK-Connect-latest.apk'
    apk.write_bytes(b'PK\x03\x04android-build')
    monkeypatch.setattr(downloads, 'APK_PATH', apk)
    url = '/downloads/SHK-Connect-latest.apk'
    response = client.get(url)
    assert response.status_code == 200
    assert response.content == apk.read_bytes()
    assert response.headers['content-type'] == 'application/vnd.android.package-archive'
    assert 'SHK-Connect-latest.apk' in response.headers['content-disposition']
    assert response.headers['x-content-type-options'] == 'nosniff'
    head = client.head(url)
    assert head.status_code == 200
    assert head.content == b''
    assert int(head.headers['content-length']) == apk.stat().st_size
    resumed = client.get(url, headers={'Range': 'bytes=4-10'})
    assert resumed.status_code == 206
    assert resumed.content == apk.read_bytes()[4:11]
    assert client.get('/downloads/another-file.apk').status_code == 404


def test_missing_apk_returns_404(client, tmp_path, monkeypatch):
    monkeypatch.setattr(downloads, 'APK_PATH', tmp_path / 'missing.apk')
    assert client.get('/downloads/SHK-Connect-latest.apk').status_code == 404
