function without_comment(source,    position, character, quote, escaped, result) {
  quote = ""
  escaped = 0
  result = ""

  for (position = 1; position <= length(source); position += 1) {
    character = substr(source, position, 1)
    if (escaped) {
      result = result character
      escaped = 0
      continue
    }
    if (quote != "" && character == "\\") {
      result = result character
      escaped = 1
      continue
    }
    if (quote != "") {
      result = result character
      if (character == quote) {
        quote = ""
      }
      continue
    }
    if (character == "\\") {
      result = result character
      escaped = 1
      continue
    }
    if (character == "\"" || character == "'") {
      quote = character
      result = result character
      continue
    }
    if (character == "#") {
      break
    }
    result = result character
  }

  return result
}

function canonical(source,    normalized) {
  normalized = source
  sub(/^[[:space:]]+/, "", normalized)
  sub(/[[:space:]]+$/, "", normalized)
  gsub(/[[:space:]]+/, " ", normalized)
  return normalized
}

function brace_count(source, expected,    position, character, quote, escaped, count) {
  quote = ""
  escaped = 0
  count = 0

  for (position = 1; position <= length(source); position += 1) {
    character = substr(source, position, 1)
    if (escaped) {
      escaped = 0
      continue
    }
    if (quote != "" && character == "\\") {
      escaped = 1
      continue
    }
    if (quote != "") {
      if (character == quote) {
        quote = ""
      }
      continue
    }
    if (character == "\\") {
      escaped = 1
      continue
    }
    if (character == "\"" || character == "'") {
      quote = character
      continue
    }
    if (character == expected) {
      count += 1
    }
  }

  return count
}

function listen_first_argument(directive,    body, tokens) {
  body = directive
  sub(/^listen /, "", body)
  sub(/;$/, "", body)
  split(body, tokens, " ")
  return tokens[1]
}

function normalized_decimal_port(value,    normalized) {
  if (value !~ /^[0-9]+$/) {
    return ""
  }
  normalized = value
  sub(/^0+/, "", normalized)
  return normalized == "" ? "0" : normalized
}

function listen_port(directive,    argument, port) {
  argument = listen_first_argument(directive)
  if (argument ~ /^[0-9]+$/) {
    return normalized_decimal_port(argument)
  }
  if (argument ~ /:[0-9]+$/) {
    port = argument
    sub(/^.*:/, "", port)
    return normalized_decimal_port(port)
  }
  return ""
}

function listen_has_option(directive, option,    body, tokens, count, position) {
  body = directive
  sub(/^listen /, "", body)
  sub(/;$/, "", body)
  count = split(body, tokens, " ")
  for (position = 2; position <= count; position += 1) {
    if (tokens[position] == option) {
      return 1
    }
  }
  return 0
}

function is_ipv6_listen(directive,    argument) {
  argument = listen_first_argument(directive)
  return argument ~ /^\[[^]]+\]:[0-9]+$/
}

function is_complete_config_line(directive, opened, closed, semicolons) {
  if (directive == "}") {
    return 1
  }
  if (opened == 0 && closed == 0 && semicolons == 1 &&
      directive ~ /;$/ &&
      (directive !~ /^include / ||
       directive == "include /etc/letsencrypt/options-ssl-nginx.conf;")) {
    return 1
  }
  if (opened == 1 && closed == 0 && semicolons == 0 &&
      directive ~ /^(location|if) .* \{$/) {
    return 1
  }
  return 0
}

function reset_location() {
  location_access_directives = 0
  location_access_off = 0
  location_error_directives = 0
  location_error_sink = 0
  location_proxy_directives = 0
  location_exact_proxy = 0
  location_includes = 0
  location_nested_blocks = 0
  location_compound_directives = 0
  location_http_version = 0
  location_header_host = 0
  location_header_real_ip = 0
  location_header_forwarded_for = 0
  location_header_forwarded_proto = 0
  location_header_upgrade = 0
  location_header_connection = 0
  location_unknown_directives = 0
}

function finish_location() {
  if (location_access_directives == 1 && location_access_off == 1 &&
      location_error_directives == 1 && location_error_sink == 1 &&
      location_proxy_directives == 1 && location_exact_proxy == 1 &&
      location_includes == 0 && location_nested_blocks == 0 &&
      location_compound_directives == 0 && location_http_version == 1 &&
      location_header_host == 1 && location_header_real_ip == 1 &&
      location_header_forwarded_for == 1 &&
      location_header_forwarded_proto == 1 &&
      location_header_upgrade == 1 && location_header_connection == 1 &&
      location_unknown_directives == 0) {
    valid_whatsapp_locations += 1
  } else {
    invalid_whatsapp_locations += 1
  }
  in_whatsapp_location = 0
}

function reset_server() {
  server_443_listens = 0
  server_insecure_443_listens = 0
  server_ipv6_443_listens = 0
  server_noncanonical_non_ipv6_443_listens = 0
  exact_tls_listens = 0
  server_name_directives = 0
  exact_server_names = 0
  certificate_directives = 0
  exact_certificates = 0
  certificate_key_directives = 0
  exact_certificate_keys = 0
  whatsapp_locations = 0
  valid_whatsapp_locations = 0
  invalid_whatsapp_locations = 0
  server_request_flow_directives = 0
  in_whatsapp_location = 0
  reset_location()
}

function finish_server() {
  if (in_whatsapp_location) {
    invalid_whatsapp_locations += 1
    in_whatsapp_location = 0
  }

  if (server_443_listens > 0) {
    port_443_servers += 1
    if (exact_tls_listens == 1 && server_insecure_443_listens == 0 &&
        server_ipv6_443_listens <= 1 &&
        server_noncanonical_non_ipv6_443_listens == 0 &&
        server_name_directives == 1 && exact_server_names == 1 &&
        certificate_directives == 1 && exact_certificates == 1 &&
        certificate_key_directives == 1 && exact_certificate_keys == 1 &&
        whatsapp_locations == 1 && valid_whatsapp_locations == 1 &&
        invalid_whatsapp_locations == 0 &&
        server_request_flow_directives == 0) {
      valid_tls_servers += 1
    }
  }

  in_server = 0
  server_depth = 0
}

BEGIN {
  if (expected_certificate == "" || expected_certificate_key == "") {
    fatal = 1
    exit
  }
}

{
  line = without_comment($0)
  if (line ~ /^[[:space:]]*$/) {
    next
  }
  normalized = canonical(line)

  if (!in_server) {
    if (normalized == "server {") {
      in_server = 1
      server_depth = 1
      reset_server()
    } else {
      malformed = 1
    }
    next
  }

  current_depth = server_depth
  opened = brace_count(line, "{")
  closed = brace_count(line, "}")
  semicolons = brace_count(line, ";")
  starts_whatsapp_location = 0

  if (!is_complete_config_line(normalized, opened, closed, semicolons)) {
    malformed = 1
  }

  if (index(normalized, "/api/webhooks/whatsapp") > 0 &&
      normalized ~ /(^|[;}][[:space:]]*)location /) {
    global_whatsapp_path_locations += 1
  }

  if (current_depth == 1) {
    if (normalized ~ /^listen / &&
        (index(normalized, "\"") > 0 || index(normalized, "'") > 0 ||
         index(normalized, "\\") > 0)) {
      malformed = 1
    }
    if (normalized ~ /^listen / && listen_port(normalized) == "443") {
      server_443_listens += 1
      if (normalized == "listen 443 ssl;") {
        exact_tls_listens += 1
      } else if (is_ipv6_listen(normalized)) {
        server_ipv6_443_listens += 1
      } else {
        server_noncanonical_non_ipv6_443_listens += 1
      }
      if (!listen_has_option(normalized, "ssl")) {
        server_insecure_443_listens += 1
      }
    }
    if (normalized ~ /^(rewrite|try_files|error_page|return|proxy_intercept_errors|mirror|auth_request|post_action|recursive_error_pages|rewrite_by_|access_by_)/ ||
        normalized ~ /^if .* \{$/) {
      server_request_flow_directives += 1
    }
    if (normalized ~ /^server_name /) {
      server_name_directives += 1
      if (normalized == "server_name staging.fanmind.ch;") {
        exact_server_names += 1
      }
    }
    if (normalized ~ /^ssl_certificate /) {
      certificate_directives += 1
      if (normalized == "ssl_certificate " expected_certificate ";") {
        exact_certificates += 1
      }
    }
    if (normalized ~ /^ssl_certificate_key /) {
      certificate_key_directives += 1
      if (normalized == "ssl_certificate_key " expected_certificate_key ";") {
        exact_certificate_keys += 1
      }
    }
    if (normalized == "location = /api/webhooks/whatsapp {") {
      global_whatsapp_locations += 1
      whatsapp_locations += 1
      in_whatsapp_location = 1
      whatsapp_location_depth = current_depth + 1
      starts_whatsapp_location = 1
      reset_location()
    }
  }

  if (in_whatsapp_location && current_depth == whatsapp_location_depth) {
    known_location_directive = 0
    if (normalized == "}") {
      known_location_directive = 1
    }
    if (normalized ~ /^access_log /) {
      location_access_directives += 1
      if (normalized == "access_log off;") {
        location_access_off += 1
        known_location_directive = 1
      }
    }
    if (normalized ~ /^error_log /) {
      location_error_directives += 1
      if (normalized == "error_log /dev/null crit;") {
        location_error_sink += 1
        known_location_directive = 1
      }
    }
    if (normalized ~ /^proxy_pass /) {
      location_proxy_directives += 1
      if (normalized == "proxy_pass http://127.0.0.1:3001;") {
        location_exact_proxy += 1
        known_location_directive = 1
      }
    }
    if (normalized == "proxy_http_version 1.1;") {
      location_http_version += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header Host $host;") {
      location_header_host += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header X-Real-IP $remote_addr;") {
      location_header_real_ip += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;") {
      location_header_forwarded_for += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header X-Forwarded-Proto $scheme;") {
      location_header_forwarded_proto += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header Upgrade $http_upgrade;") {
      location_header_upgrade += 1
      known_location_directive = 1
    }
    if (normalized == "proxy_set_header Connection \"upgrade\";") {
      location_header_connection += 1
      known_location_directive = 1
    }
    if (normalized ~ /^include /) {
      location_includes += 1
    }
    if (!starts_whatsapp_location && opened > 0) {
      location_nested_blocks += opened
    }
    if (semicolons > 1) {
      location_compound_directives += 1
    }
    if (!known_location_directive) {
      location_unknown_directives += 1
    }
  }

  server_depth += opened - closed

  if (in_whatsapp_location && server_depth < whatsapp_location_depth) {
    finish_location()
  }
  if (server_depth == 0) {
    finish_server()
  } else if (server_depth < 0) {
    malformed = 1
    finish_server()
  }
}

END {
  if (fatal || in_server || malformed || port_443_servers != 1 ||
      valid_tls_servers != 1 || global_whatsapp_locations != 1 ||
      global_whatsapp_path_locations != 1) {
    print "invalid"
  } else {
    print "valid"
  }
}
