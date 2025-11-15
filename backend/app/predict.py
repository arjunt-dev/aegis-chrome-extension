import math
import re
from urllib.parse import urlparse
from fastapi import HTTPException,status
import pandas as pd
from config import BASE_MODEL, META_MODEL
from urllib.parse import urlparse, parse_qs
import tldextract
import whois
from datetime import datetime,timezone
    
def extract_features_from_url(url: str):
    parsed = urlparse(url)
    ext = tldextract.extract(url)
    domain = ext.domain or ""
    suffix = ext.suffix or ""
    subdomain = ext.subdomain or ""
    full_domain = ".".join(x for x in [subdomain, domain, suffix] if x)

    path = parsed.path or ""
    query = parsed.query or ""
    url_length = len(url)
    ip_pattern = r"(\d{1,3}\.){3}\d{1,3}"
    has_ip_address = 1 if re.search(ip_pattern, full_domain) else 0
    dot_count = url.count(".")
    https_flag = 1 if parsed.scheme == "https" else 0

    def shannon_entropy(s):
        if not s:
            return 0.0
        probs = [float(s.count(c)) / len(s) for c in set(s)]
        return -sum(p * math.log2(p) for p in probs)

    url_entropy = shannon_entropy(url)
    token_count = len(re.split(r'\W+', url))
    subdomain_count = len([x for x in subdomain.split('.') if x]) if subdomain else 0
    query_param_count = len(parse_qs(query))
    tld_length = len(suffix)
    path_length = len(path)
    has_hyphen_in_domain = 1 if '-' in full_domain else 0
    number_of_digits = sum(c.isdigit() for c in url)
    popular_tlds = {"com","org","net","in","co","edu","gov"}
    tld_popularity = 1 if suffix in popular_tlds else 0
    suspicious_exts = {".exe",".zip",".rar",".apk",".dll",".bat",".cmd",".scr"}
    suspicious_file_extension = 1 if any(url.lower().endswith(ext) for ext in suspicious_exts) else 0
    domain_name_length = len(domain)
    percentage_numeric_chars = sum(c.isdigit() for c in url) / len(url) if len(url)>0 else 0.0

    feat = {
        'url_length': url_length,
        'has_ip_address': has_ip_address,
        'dot_count': dot_count,
        'https_flag': https_flag,
        'url_entropy': url_entropy,
        'token_count': token_count,
        'subdomain_count': subdomain_count,
        'query_param_count': query_param_count,
        'tld_length': tld_length,
        'path_length': path_length,
        'has_hyphen_in_domain': has_hyphen_in_domain,
        'number_of_digits': number_of_digits,
        'tld_popularity': tld_popularity,
        'suspicious_file_extension': suspicious_file_extension,
        'domain_name_length': domain_name_length,
        'percentage_numeric_chars': percentage_numeric_chars
    }
    return feat

def predict_url(url: str):
        feat_cols = BASE_MODEL["feature_columns"]
        feat_dict = extract_features_from_url(url)
        X_row = pd.DataFrame([feat_dict])[feat_cols]
        p_cat = BASE_MODEL["base_cat"].predict_proba(X_row)[:, 1][0]
        p_et  = BASE_MODEL["base_ext"].predict_proba(X_row)[:, 1][0] 
        p_rf  = BASE_MODEL["base_rf"].predict_proba(X_row)[:, 1][0]
        X_lr = X_row   
        X_lr_scaled = META_MODEL.transform(X_lr)
        p_lr = BASE_MODEL["base_lr"].predict_proba(X_lr_scaled)[:, 1][0]
        meta = pd.DataFrame([{
        "cat_pred": p_cat,
        "ext_pred": p_et,
        "rf_pred": p_rf,
        "lr_pred": p_lr
        }])
        meta_scaled = BASE_MODEL["meta_scaler"].transform(meta)

        final_prob_legit = BASE_MODEL["meta_lr"].predict_proba(meta_scaled)[0, 1]
        prob_phishing = 1 - final_prob_legit
        if prob_phishing < 0.10:
            risk = 1
            confidence = float(final_prob_legit)
        elif prob_phishing < 0.40:
            risk = 0
            confidence = max(final_prob_legit, prob_phishing)
        else:
            risk = -1
            confidence = float(prob_phishing)

        # --- 5. Final JSON ---
        return {
            "url": url,
            "prediction": risk,
            "confidence": float(confidence),
            # "prob_phishing": float(prob_phishing),
            # "prob_legitimate": float(final_prob_legit),
            # "prediction_label": int(label_pred),
            # "base_model_scores": {
            #     "catboost": float(p_cat),
            #     "extratrees": float(p_et),
            #     "randomforest": float(p_rf),
            #     "logistic": float(p_lr)
            # }
        }