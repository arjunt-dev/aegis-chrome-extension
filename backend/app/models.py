from tortoise import fields,models

class User(models.Model):
    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=100, unique=True)
    password = fields.CharField(max_length=128)
    secret = fields.CharField(max_length=32)
    is_active = fields.BooleanField(default=False)
    
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

class Blocklist(models.Model):
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='blacklists', on_delete=fields.CASCADE)
    url = fields.CharField(max_length=1000, unique=True)
    added_at = fields.DatetimeField(auto_now=True)

class History(models.Model):
    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField("models.User", related_name='histories', on_delete=fields.CASCADE)
    url = fields.CharField(max_length=1000, unique=True)
    result = fields.CharField(max_length=50)
    checked_at = fields.DatetimeField(auto_now_add=True)

class IssuedToken(models.Model):
    id = fields.IntField(pk=True)
    jti = fields.CharField(max_length=64, unique=True)
    valid_until = fields.DatetimeField()