// Path helpers that run in linear time. Request paths come from clients (raw
// URLs and fetchPage arguments), so regexes such as /\/+$/ — quadratic on a
// long run of slashes that is not at the end — are avoided.

/** "/a/b///" -> "/a/b"; "///" -> "". */
export function trimTrailingSlashes(s) {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === 47) end--;
  return end === s.length ? s : s.slice(0, end);
}

/** "//a/b//" -> "a/b". */
export function trimSlashes(s) {
  let start = 0;
  while (start < s.length && s.charCodeAt(start) === 47) start++;
  return trimTrailingSlashes(s.slice(start));
}

/**
 * "//host//x" -> "/host/x". A path that starts with "//" (or "/\") would name
 * another host if it were ever resolved as a URL reference, so asset paths
 * are collapsed before they reach a fetch.
 */
export function collapseSlashes(s) {
  return s.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}
