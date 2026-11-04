"""Templated SMS notifications sent to students at key moments: account
created, documents verified, and a monthly payment transferred.

Each function looks up the student's preferred language and sends through
app.services.sms.send_sms, which never raises — a notification failure never
blocks the action (registration, verification, payment) that triggered it.
"""
from datetime import datetime
from typing import Optional

from app.services.sms import send_sms

_LANGS = ("en", "hi", "mr")


def _template(templates: dict, language: Optional[str]) -> str:
    return templates.get(language or "", templates["en"])


_ACCOUNT_CREATED = {
    "en": "{name}, your Shidori account has been created. Log in to finish your profile and apply for meal support.",
    "hi": "{name}, आपका शिदोरी खाता बन गया है। अपनी प्रोफ़ाइल पूरी करने और भोजन सहायता के लिए आवेदन करने हेतु लॉगिन करें।",
    "mr": "{name}, तुमचे शिदोरी खाते तयार झाले आहे. प्रोफाइल पूर्ण करण्यासाठी आणि भोजन सहाय्यासाठी अर्ज करण्यासाठी लॉगिन करा.",
}

_DOCUMENTS_VERIFIED = {
    "en": "{name}, your Shidori documents have been verified. You are now accepted for monthly meal support.",
    "hi": "{name}, आपके शिदोरी दस्तावेज़ सत्यापित हो गए हैं। अब आप मासिक भोजन सहायता के लिए स्वीकृत हैं।",
    "mr": "{name}, तुमची शिदोरी कागदपत्रे पडताळली गेली आहेत. आता तुम्ही मासिक भोजन सहाय्यासाठी स्वीकृत आहात.",
}

_PAYMENT_TRANSFERRED = {
    "en": "{name}, Rs {amount} for {period} has been transferred to your bank account by Shidori. Thank you for your patience.",
    "hi": "{name}, शिदोरी द्वारा {period} के लिए ₹{amount} आपके बैंक खाते में भेज दिए गए हैं। धन्यवाद।",
    "mr": "{name}, शिदोरीने {period} साठी ₹{amount} तुमच्या बँक खात्यात पाठवले आहेत. धन्यवाद.",
}


async def account_created(phone: str, name: str, language: Optional[str]) -> None:
    await send_sms(phone, _template(_ACCOUNT_CREATED, language).format(name=name))


async def documents_verified(phone: str, name: str, language: Optional[str]) -> None:
    await send_sms(phone, _template(_DOCUMENTS_VERIFIED, language).format(name=name))


async def payment_transferred(phone: str, name: str, amount: int, period: str, language: Optional[str]) -> None:
    try:
        period_label = datetime.strptime(period, "%Y-%m").strftime("%B %Y")
    except ValueError:
        period_label = period
    await send_sms(phone, _template(_PAYMENT_TRANSFERRED, language).format(name=name, amount=amount, period=period_label))
