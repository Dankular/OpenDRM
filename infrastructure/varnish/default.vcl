vcl 4.1;

# OpenDRM Varnish Configuration
# High-performance caching layer for video segments

import std;

# Backend definition - NGINX origin server
backend default {
    .host = "nginx-origin";
    .port = "80";
    .connect_timeout = 5s;
    .first_byte_timeout = 60s;
    .between_bytes_timeout = 30s;
    .max_connections = 100;

    # Health check
    .probe = {
        .url = "/health";
        .timeout = 2s;
        .interval = 5s;
        .window = 5;
        .threshold = 3;
    }
}

sub vcl_recv {
    # Handle preflight requests
    if (req.method == "OPTIONS") {
        return (synth(204, "No Content"));
    }

    # Only cache GET and HEAD
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }

    # Remove cookies for static content
    if (req.url ~ "\.(mpd|m3u8|ts|m4s|mp4|init|fmp4)$") {
        unset req.http.Cookie;
        return (hash);
    }

    # Pass everything else
    return (pass);
}

sub vcl_hash {
    hash_data(req.url);

    # Include Range header in hash for partial content
    if (req.http.Range) {
        hash_data(req.http.Range);
    }

    return (lookup);
}

sub vcl_backend_response {
    # Cache video segments
    if (bereq.url ~ "\.(mpd|m3u8|ts|m4s|mp4|init|fmp4)$") {
        # Set TTL based on content type
        if (bereq.url ~ "\.mpd$" || bereq.url ~ "\.m3u8$") {
            # Short TTL for manifests (may update frequently)
            set beresp.ttl = 2s;
            set beresp.grace = 30s;
        } else if (bereq.url ~ "\.(ts|m4s|mp4|init|fmp4)$") {
            # Longer TTL for segments (immutable content)
            set beresp.ttl = 24h;
            set beresp.grace = 1h;
        }

        # Remove Set-Cookie for cached content
        unset beresp.http.Set-Cookie;

        # Enable streaming
        set beresp.do_stream = true;
    }

    # Handle failed responses
    if (beresp.status >= 500) {
        set beresp.ttl = 0s;
        set beresp.grace = 0s;
        return (deliver);
    }

    return (deliver);
}

sub vcl_deliver {
    # Add cache status header
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
        set resp.http.X-Cache-Hits = obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }

    # Remove internal headers
    unset resp.http.X-Varnish;
    unset resp.http.Via;

    # CORS headers
    set resp.http.Access-Control-Allow-Origin = "*";
    set resp.http.Access-Control-Allow-Methods = "GET, HEAD, OPTIONS";
    set resp.http.Access-Control-Allow-Headers = "Range, Origin, Content-Type";
    set resp.http.Access-Control-Expose-Headers = "Content-Length, Content-Range";

    # Cache headers
    set resp.http.Vary = "Accept-Encoding";

    return (deliver);
}

sub vcl_synth {
    # Handle preflight responses
    if (resp.status == 204) {
        set resp.http.Access-Control-Allow-Origin = "*";
        set resp.http.Access-Control-Allow-Methods = "GET, HEAD, OPTIONS";
        set resp.http.Access-Control-Allow-Headers = "Range, Origin, Content-Type";
        set resp.http.Access-Control-Max-Age = "86400";
        return (deliver);
    }
}

# Purge support
sub vcl_recv {
    if (req.method == "PURGE") {
        # ACL check would go here in production
        return (purge);
    }

    if (req.method == "BAN") {
        ban("req.url ~ " + req.url);
        return (synth(200, "Banned"));
    }
}

sub vcl_purge {
    return (synth(200, "Purged"));
}
