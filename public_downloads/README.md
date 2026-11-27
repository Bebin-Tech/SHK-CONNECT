The deployment packages the verified Android testing build here as
`SHK-Connect-latest.apk`. APK binaries are excluded from Git.

The public `/downloads/SHK-Connect-latest.apk` endpoint serves only that file,
supports resumable downloads, and does not require a GitHub or app account.
Application sign-in and private attachment permissions remain required.

When deploying a new Android version, place its verified APK in this directory
before uploading the Docker build context. If the APK is absent, the endpoint
returns 404.
