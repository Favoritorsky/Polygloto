"""CI: проверяет вход в SMTP (Gmail) с секретами SMTP_USER / SMTP_PASSWORD.

Печатает понятную причину ошибки, пароль не выводит. С --send отправляет
тестовое письмо на ADMIN_EMAIL. Код выхода 0 — вход удался, 2 — секретов нет,
1 — ошибка входа или отправки.
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

user = (os.environ.get("SMTP_USER") or "").strip()
password = "".join((os.environ.get("SMTP_PASSWORD") or "").split())
host = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
if not user or not password:
    print("SMTP_USER/SMTP_PASSWORD не заданы.")
    sys.exit(2)

masked = user[0] + "***@" + user.split("@")[-1]
print(f"Ящик: {masked}, длина пароля: {len(password)} (у пароля приложения Google — 16)")
try:
    with smtplib.SMTP_SSL(host, 465, context=ssl.create_default_context(), timeout=30) as smtp:
        smtp.login(user, password)
        print("Вход в SMTP: успешно.")
        if "--send" in sys.argv:
            to = (os.environ.get("ADMIN_EMAIL") or user).split(",")[0].strip()
            msg = EmailMessage()
            msg["From"] = f"Polygloto <{user}>"
            msg["To"] = to
            msg["Subject"] = "Polygloto: проверка отправки писем"
            msg.set_content("Это тестовое письмо: отправка писем сайта Polygloto работает.")
            smtp.send_message(msg)
            print("Тестовое письмо отправлено на адрес администратора.")
except smtplib.SMTPAuthenticationError as error:
    print(f"Gmail отклонил вход ({error.smtp_code}): {error.smtp_error.decode(errors='replace')[:200]}")
    sys.exit(1)
except Exception as error:  # noqa: BLE001
    print(f"Ошибка SMTP: {type(error).__name__}: {error}")
    sys.exit(1)
