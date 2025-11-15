from fastapi_mail import FastMail, MessageSchema, MessageType
from config import MAIL_CONFIG

async def send_otp_email(recipient: str, otp: str):
    """
    Send OTP to the specified email using Gmail via FastAPI-Mail.
    """
    subject = "Your Account Verification OTP"
    body = f"""
    <div style="font-family: Arial; line-height: 1.5;">
        <h2>Welcome to Aegis!</h2>
        <p>Your One-Time Password (OTP) for account verification is:</p>
        <h3 style="color: #2e86de;">{otp}</h3>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br><b>Aegis Security Team</b></p>
    </div>
    """

    message = MessageSchema(
        subject=subject,
        recipients=[recipient], 
        body=body,
        subtype=MessageType.html
    )
    
    fm = FastMail(MAIL_CONFIG)
    await fm.send_message(message)
    print(f"[Mail] OTP sent successfully to {recipient}")