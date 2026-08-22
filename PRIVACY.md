# Privacy Policy — Timer Tracker

**Effective date:** 22 August 2026
**Applies to:** Timer Tracker for Windows, distributed through the Microsoft Store

## Summary

Timer Tracker does not collect, transmit, or share any of your data. Everything
you enter stays on your own computer. The app has no accounts, no servers, no
analytics, and no network features of any kind.

## What the app stores

Timer Tracker saves the information you enter so it is still there next time you
open the app. This is kept in a SQLite database file on your computer:

- **Projects** — the project name, whether it is billable, and the hourly rate
  you set
- **Timers** — the project a timer belongs to, its start and end time, the
  duration, the task description you type, and the calculated amount earned
- **Your theme preference** — whether you chose light, dark, or system

The app also writes the ordinary support files that any Windows desktop
application creates, such as window settings and internal caches. These contain
no personal information beyond what is listed above.

## Where your data is stored

When installed from the Microsoft Store, your data is kept inside the app's
private storage area on your PC:

```
C:\Users\<you>\AppData\Local\Packages\<package name>\LocalCache\Roaming\time-tracker\timers.db
```

If you previously used a non-Store build of Timer Tracker, the app copies that
older database into the location above the first time it runs, so your existing
projects and timers are not lost. This is a local file copy on your own machine;
nothing is uploaded.

Uninstalling Timer Tracker through Windows Settings removes the app and its
stored data.

## Data you export yourself

The CSV export feature writes your timer data to a file. Timer Tracker always
asks you where to save it and never writes it anywhere without you choosing the
location. Once the file is saved, it is an ordinary file under your control — if
you email it, upload it, or put it in a shared folder, that is your decision and
this policy no longer governs it.

## What the app does not do

Timer Tracker contains no code that connects to the internet. Specifically, it
does not:

- send your data anywhere, or receive data from anywhere
- use analytics, telemetry, crash reporting, advertising, or tracking of any kind
- require an account, a sign-in, or an email address
- read your files, contacts, location, camera, microphone, or clipboard
- show ads or contain in-app purchases

No third party receives your information, because no information leaves your
device.

## Permissions

Timer Tracker declares one Windows capability, `runFullTrust`. This is the
standard requirement for a traditional Windows desktop application to run, and
it is not a request for access to your personal data.

## Updates to the app

Updates are delivered by the Microsoft Store. Timer Tracker has no self-update
mechanism and does not contact any server to check for new versions.

Please note that the Microsoft Store itself, and Windows, may collect
information about app installations and usage independently of Timer Tracker.
That collection is governed by the
[Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement),
not by this policy.

## Children

Timer Tracker is a general-purpose productivity tool. It does not knowingly
collect information from anyone, including children, because it does not collect
information at all.

## Your control over your data

Because your data never leaves your computer, you control it directly:

- **View or change it** — through the app's Projects and Timers screens
- **Delete it** — delete individual projects and timers in the app, or uninstall
  the app to remove everything
- **Take a copy** — use the CSV export, or copy the `timers.db` file

There is no request process, because there is no one holding your data but you.

## Changes to this policy

If this policy changes, the updated version will be published at this address
and the effective date at the top will be revised. Material changes will be
noted in the app's Store release notes.

## Contact

Questions about this policy can be raised at
<https://github.com/flvrm92/timer-tracker/issues>.
