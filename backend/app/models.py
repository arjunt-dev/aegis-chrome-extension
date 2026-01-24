from tortoise import fields, models

class User(models.Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=100, unique=True)
    password = fields.CharField(max_length=128)   # Argon2 hash
    password_salt = fields.CharField(max_length=64)  # PBKDF2 salt
    encrypted_master_key = fields.TextField()
    is_active = fields.BooleanField(default=False)
    created_at = fields.DatetimeField(auto_now_add=True)
    
    def __str__(self):
        return self.email

class Otp(models.Model):
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='otps', on_delete=fields.CASCADE)
    code = fields.CharField(max_length=6)
    created_at = fields.DatetimeField(auto_now_add=True)
    is_used = fields.BooleanField(default=False)
    expires_at = fields.DatetimeField()

    def __str__(self):
        return f"OTP for {self.user.email}: {self.code}"

class Vault(models.Model):
    id = fields.IntField(pk=True)
    user = fields.OneToOneField("models.User", related_name="vault")
    encrypted_blob = fields.TextField()
    updated_at = fields.DatetimeField(auto_now=True)
