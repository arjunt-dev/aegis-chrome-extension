import math
import re
from urllib.parse import urlparse
from xml.parsers.expat import model
from fastapi import HTTPException
import pandas as pd
from app.config import BASE_MODEL, MAX_URL_LENGTH , MIN_BRAND_LEN_FOR_FUZZY,  DATA_JSON
from urllib.parse import urlparse, parse_qs
import tldextract
from app.logging_config import logger
from rapidfuzz.distance import Levenshtein
from rapidfuzz.fuzz import ratio

def shannon_entropy(s):
    if not s:
        return 0.0
    probs = [float(s.count(c)) / len(s) for c in set(s)]
    return -sum(p * math.log2(p) for p in probs)

def brand_lookalike(domain_str, brand_set, ratio_threshold=0.82, max_edit_distance=2):
        if not domain_str or domain_str in brand_set:
            return None, 0.0
        best_brand, best_ratio = None, 0.0
        for b in brand_set:
            if len(b) < MIN_BRAND_LEN_FOR_FUZZY:
                continue   # skip short brands entirely for fuzzy matching

            similarity = ratio(domain_str, b) / 100.0
            if similarity < ratio_threshold:
                continue
            edit_dist = Levenshtein.distance(domain_str, b)
            if edit_dist > max_edit_distance:
                continue

            if similarity > best_ratio:
                best_brand, best_ratio = b, similarity
        return best_brand , best_ratio
    
def extract_features_from_url(url: str):
    parsed = urlparse(url)
    ext = tldextract.extract(url)

    # Domain-only 
    domain_url = f"{parsed.scheme}://{parsed.netloc}"

    domain = ext.domain or ""
    suffix = ext.suffix or ""
    subdomain = ext.subdomain or ""
    subdomain = ".".join(p for p in subdomain.split(".") if p and p != "www")
    full_domain = ".".join(x for x in [subdomain, domain, suffix] if x)

    url_length = len(domain_url)

    
    # Tokenization — hostname only (computed once, reused everywhere)
    
    hostname_tokens = [t.lower() for t in re.split(r"[.-]", full_domain) if t]
    joined_hostname_text = " ".join(hostname_tokens)

    
    # Entropy
    
    

    url_entropy = shannon_entropy(domain_url)
    hostname_entropy = shannon_entropy(full_domain)

    
    # Domain features
    
    has_ip_address = int(bool(re.search(r"(\d{1,3}\.){3}\d{1,3}", full_domain)))
    dot_count = domain_url.count(".")
    https_flag = int(parsed.scheme == "https")
    token_count = len(re.split(r"\W+", domain_url))
    subdomain_count = len([x for x in subdomain.split(".") if x]) if subdomain else 0
    tld_length = len(suffix)
    has_hyphen_in_domain = int("-" in full_domain)
    number_of_digits = sum(c.isdigit() for c in domain_url)
    tld_popularity = int(suffix in DATA_JSON.get("popular_tlds", set()))
    domain_name_length = len(domain)

    
    # Character ratios
    # letter_ratio + digit_ratio + "special" ratio always sum to 1
    
    letters = sum(c.isalpha() for c in domain_url)
    letter_ratio = letters / url_length if url_length else 0
    digit_ratio = number_of_digits / url_length if url_length else 0

    
    # Hostname statistics
    
    hostname_token_count = len(hostname_tokens)
    avg_hostname_token_length = (
        sum(len(t) for t in hostname_tokens) / hostname_token_count
        if hostname_token_count else 0
    )
    longest_hostname_token = max((len(t) for t in hostname_tokens), default=0)

    
    # Brand features
    brand_data = DATA_JSON.get("brand_data", {})
    brands = set(brand_data.keys())

    found_brands = [b for b in brands if b in joined_hostname_text]
    brand_in_registered_domain = int(domain.lower() in brands)
    brand_only_in_subdomain = int(
        len(found_brands) > 0 and not brand_in_registered_domain
    )

    lookalike_brand, brand_similarity = brand_lookalike(domain.lower(), brands)
    brand_lookalike_flag = int(lookalike_brand is not None)

    effective_brands = set(found_brands)
    if lookalike_brand:
        effective_brands.add(lookalike_brand)

    contains_brand = int(len(effective_brands) > 0)   
    brand_count = len(effective_brands)

    brand_phishing_rank = 0
    if effective_brands:
        brand_phishing_rank = min(
            brand_data[b].get("rank", 99)
            for b in effective_brands if b in brand_data
        )

    
    # Keyword features — hostname only
    
    keyword_count = sum(1 for kw in DATA_JSON.get("suspicious_keywords", []) if kw in joined_hostname_text)
    brand_keyword_combo = int(contains_brand and keyword_count > 0)

    at_symbol_count = domain_url.count("@")
    is_shortened = int(full_domain in DATA_JSON.get("url_shorteners", set()))
    has_punycode = int("xn--" in full_domain)

    
    # Known-phishing-domain similarity 
    
    matched_known_phishing_domain = 0
    known_phishing_domain_similarity = 0.0
    if effective_brands:
        all_known_domains = []
        for b in effective_brands:
            all_known_domains.extend(brand_data.get(b, {}).get("phishing_domains", []))
        for known_domain in all_known_domains:
            if full_domain == known_domain:
                matched_known_phishing_domain = 1
            similarity = ratio(full_domain, known_domain) / 100.0
            known_phishing_domain_similarity = max(known_phishing_domain_similarity, similarity)

    
    # Digit run
    
    max_digit_run = 0
    current = 0
    for c in domain_url:
        if c.isdigit():
            current += 1
            max_digit_run = max(max_digit_run, current)
        else:
            current = 0

    
    # Domain reputation — module-level `known_domains_snapshot`, loaded
    
    is_known_domain = int(full_domain in DATA_JSON.get("known_domains", set()))

    return {
        "url_length": url_length,
        "has_ip_address": has_ip_address,
        "dot_count": dot_count,
        "https_flag": https_flag,
        "url_entropy": url_entropy,
        "token_count": token_count,
        "subdomain_count": subdomain_count,
        "tld_length": tld_length,
        "has_hyphen_in_domain": has_hyphen_in_domain,
        "number_of_digits": number_of_digits,
        "tld_popularity": tld_popularity,
        "domain_name_length": domain_name_length,

        "hostname_entropy": hostname_entropy,

        "letter_ratio": letter_ratio,
        "digit_ratio": digit_ratio,

        "hostname_token_count": hostname_token_count,
        "avg_hostname_token_length": avg_hostname_token_length,
        "longest_hostname_token": longest_hostname_token,

        "brand_count": brand_count,
        "brand_in_registered_domain": brand_in_registered_domain,
        "brand_only_in_subdomain": brand_only_in_subdomain,

        "keyword_count": keyword_count,
        "brand_keyword_combo": brand_keyword_combo,

        "max_digit_run": max_digit_run,
        "at_symbol_count": at_symbol_count,
        "is_shortened": is_shortened,
        "has_punycode": has_punycode,
        "brand_phishing_rank": brand_phishing_rank,
        "matched_known_phishing_domain": matched_known_phishing_domain,
        "known_phishing_domain_similarity": known_phishing_domain_similarity,
        "brand_lookalike_flag": brand_lookalike_flag,
        "brand_similarity": brand_similarity,
        "is_known_domain": is_known_domain,

        "_registered_domain": f"{domain}.{suffix}" if suffix else domain,
    }

def predict_url(url: str):   
        if len(url) > MAX_URL_LENGTH:
            raise HTTPException(413, "URL too long")
        try:
            if BASE_MODEL is None:
                raise HTTPException(500, "Model not loaded")         
            feat_cols = [c for c in BASE_MODEL["feature_columns"] if c != "_registered_domain"]
 
            feat_dict = extract_features_from_url(url)
        
            X_row = pd.DataFrame([feat_dict]).reindex(columns=feat_cols)
            X_row = X_row.apply(pd.to_numeric, errors="coerce").fillna(0)
        
            p_cat = BASE_MODEL["base_cat"].predict_proba(X_row)[:, 1][0]
            p_et = BASE_MODEL["base_ext"].predict_proba(X_row)[:, 1][0]
            p_rf = BASE_MODEL["base_rf"].predict_proba(X_row)[:, 1][0]
        
            # Strip path/query for TF-IDF (model trained on domain-only URLs)
            domain_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
            p_tfidf = BASE_MODEL["base_tfidf"].predict_proba(
                BASE_MODEL["tfidf_vectorizer"].transform([domain_url]))[:, 1][0]
        
            meta = pd.DataFrame([{
                "cat_pred": p_cat, "ext_pred": p_et, "rf_pred": p_rf,
                "tfidf_lr_pred": p_tfidf
            }])
            meta_scaled = BASE_MODEL["meta_scaler"].transform(meta)
            final_prob_legit = BASE_MODEL["meta_lr"].predict_proba(meta_scaled)[0, 1]
            prob_phishing = 1 - final_prob_legit
            thr = BASE_MODEL["decision_threshold"]
            label_pred = 1 if final_prob_legit >= thr else 0
        
            bands = BASE_MODEL["risk_bands"]
            risk, confidence = ("Safe", final_prob_legit) if prob_phishing < bands["legit_max"] \
                else ("Suspicious", prob_phishing) if prob_phishing < bands["suspicious_max"] \
                else ("Phishing", prob_phishing)
            
            return {
                "url": url,
                "prediction": risk,
                "confidence": float(confidence),
            }
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            raise HTTPException(500, "Prediction failed")