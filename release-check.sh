#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
pushd "$DIR";

throw() { echo "fatal: $1"; exit 1; }

[[ -z `which gawk` ]] && throw "gawk is not installed!";
[[ -z `which vsce` ]] && throw "vsce is not installed!";

get_version() {
	gawk '/"version":/ { match($0, /"([0-9\.]+)"/, result); print result[1]; exit 0; }' "$1";
}
release_version="$(get_version package.json)";
release_version_in_lock="$(get_version package-lock.json)";
if [[ "$release_version" != "$release_version_in_lock" ]]; then
	echo "package.json:         $release_version";
	echo "package-loack.json:   $release_version_in_lock";
	throw "version in package.json is difference with version in package-lock.json !";
fi


change_log_title="### $release_version";
has_change_log_title() {
	gawk -vdetect="$change_log_title" 'index($0, detect) == 1 {print $0; exit 0;}' "$1";
}
[[ -z "$(has_change_log_title README.md)" ]] && throw "README.md doesn't contain \"$change_log_title\"";
[[ -z "$(has_change_log_title CHANGELOG.md)" ]] && throw "CHANGELOG.md doesn't contain \"$change_log_title\"";


echo "packing up archive files ...";
npm pack || throw "npm pack failed!";
vsce package || throw "vsce package failed!";

echo "the target archive files ...";
ls *.{tgz,vsix} -alh;

# about git
if [[ -n `git status --short` ]]; then git status --short; throw "there some files are not commited!"; fi
[[ "$(git push --dry-run 2>/dev/stdout)" == "Everything up-to-date" ]] || throw "there some commits are not pushed!";

echo "============================";
echo "Release Version: $release_version";
echo "";
echo "============================";
echo "Self-check:";
echo "  1. Is building passed on Travis-CI ?";
echo "  2. Is there some useless files be packed up by vsce ?";
echo "  3. Is there some useless files be packed up by npm ?";
read -p "Confirm (y/N) > " confirm;
[[ "$confirm" != y* ]] && [[ "$confirm" != Y* ]] && throw "user cancelled!";

echo "============================";
echo "Publish commands:";
echo "   npm publish";
echo "   vsce publish";
echo "   git tag $release_version -m \"Release $release_version\"";
echo "============================";
