import payment_gateway_sdk

class PaymentService:
    def __init__(self, secret_key):
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret'] # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        return self.sdk.confirm_payment(payment_intent_id)
