# Yellow Snow

### See where your fellow developers left their mark.

## Overview

This extension offers a way of viewing the recency of edits to a text file, using its git history.

In this way, it is very similar to a standard blame/annotate, but it is coloured using a gradient such that more recently changed lines are immediately more obvious. It is the author's opinion that the most recent bug is often due to the most recent change...

![Yellow Snow](https://raw.githubusercontent.com/jchown/yellow-snow-vscode/main/src/images/yellow_snow.png)

## Usage

To open a text file in this view, use the hotkey* or the `Re-open Editor With...` option on the file tab's context menu. 

*`Alt-Y` (Windows/Linux) or `Cmd ⌘-Y` (Mac OS)

## Settings

This extension currently contributes one setting:

* `yellowSnow.theme`: The colour theme to use.

By default this will be `AUTO`, which selects the Yellow Snow theme when the editor is set to a light theme, and Purple Stain when it is set to dark.

|YS - Yellow Snow|PS - Purple Stain|
|-|-|
|<img src="https://raw.githubusercontent.com/jchown/yellow-snow-vscode/main/src/images/yellow_snow.png" width=385 height=249>|<img src="https://raw.githubusercontent.com/jchown/yellow-snow-vscode/main/src/images/purple_stain.png" width=385 height=249>|

## Version History

See <a href="https://github.com/jchown/yellow-snow-vscode/blob/main/CHANGELOG.md">change log</a>.

## Copyright

Copyright &copy; 2024, Jason Chown. Issued under an <a href="https://github.com/jchown/yellow-snow-vscode/blob/main/LICENSE.md">MIT license</a>. 

PRs gratefully received.