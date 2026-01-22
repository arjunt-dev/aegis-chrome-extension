from tortoise import fields, models

class User(models.Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=100, unique=True)
    password = fields.CharField(max_length=128)  # Argon2 hash for authentication only
    
    # Zero-knowledge key derivation
    password_salt = fields.CharField(max_length=64)  # Salt for PBKDF2
    
    # Encrypted master key (the "magic box" wrapped by password)
    encrypted_master_key = fields.TextField()
    master_key_version = fields.IntField(default=1)
    
    # Account status
    is_active = fields.BooleanField(default=False)
    created_at = fields.DatetimeField(auto_now_add=True)
    last_password_change = fields.DatetimeField(null=True)
    
    def __str__(self):
        return self.email

class RecoveryCode(models.Model):
    """One-time recovery codes for password reset"""
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='recovery_codes', on_delete=fields.CASCADE)
    code_hash = fields.CharField(max_length=128) 
    encrypted_master_key = fields.TextField()
    is_used = fields.BooleanField(default=False)
    created_at = fields.DatetimeField(auto_now_add=True)
    used_at = fields.DatetimeField(null=True)

class Otp(models.Model):
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='otps', on_delete=fields.CASCADE)
    code = fields.CharField(max_length=6)
    created_at = fields.DatetimeField(auto_now_add=True)
    is_used = fields.BooleanField(default=False)
    expires_at = fields.DatetimeField()
    purpose = fields.CharField(max_length=50, default='verification')  # 'verification', 'password_reset'

    def __str__(self):
        return f"OTP for {self.user.email}: {self.code}"

class Blocklist(models.Model):
    """Zero-knowledge blocklist - URLs encrypted client-side"""
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='blacklists', on_delete=fields.CASCADE)
    
    # Encrypted URL (server cannot decrypt)
    encrypted_url = fields.TextField()
    
    # SHA256 hash for deduplication (server can check duplicates without seeing URL)
    url_hash = fields.CharField(max_length=64)
    
    added_at = fields.DatetimeField(auto_now_add=True)
    
    class Meta:
        unique_together = (("user", "url_hash"),)
        indexes = [("user", "url_hash")]

class History(models.Model):
    """Zero-knowledge history - URLs encrypted client-side"""
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='histories', on_delete=fields.CASCADE)
    
    # Encrypted URL (server cannot decrypt)
    encrypted_url = fields.TextField()
    
    # SHA256 hash for search/deduplication
    url_hash = fields.CharField(max_length=64)
    
    # ML prediction results (can be plaintext - not sensitive)
    result = fields.CharField(max_length=50)
    confidence = fields.FloatField(null=True)
    
    checked_at = fields.DatetimeField(auto_now_add=True)
    
    class Meta:
        indexes = [("user", "checked_at"), ("user", "url_hash")]