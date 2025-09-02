```python
"""
Date: 02/09/2025
User: Agentic_AI_System_Documenter
Code Language: Python
"""

import payment_gateway_sdk

class PaymentService:
    """
    A service class for handling payment operations using the payment gateway SDK.

    Attributes:
        sdk (payment_gateway_sdk.SDK): An instance of the payment gateway SDK.
    """
    
    def __init__(self, secret_key):
        """
        Initializes the PaymentService with a secret key.

        Parameters:
            secret_key (str): The secret key to authenticate the SDK.
        """
        self.sdk = payment_gateway_sdk.SDK(secret_key)

    def create_payment_intent(self, amount_in_cents, currency):
        """
        Creates a payment intent with the specified amount and currency.

        Parameters:
            amount_in_cents (int): The amount to be charged, in cents.
            currency (str): The currency in which the payment will be made.

        Returns:
            str: The client secret or unique ID to be used on the client side.
        """
        # Call the SDK to create a payment intent
        intent = self.sdk.create_payment_intent(amount_in_cents, currency)
        return intent['client_secret']  # Or a unique ID for client-side use

    def confirm_payment(self, payment_intent_id):
        """
        Confirms a payment using the provided payment intent ID.

        Parameters:
            payment_intent_id (str): The ID of the payment intent to confirm.

        Returns:
            dict: The result of the payment confirmation action.
        """
        return self.sdk.confirm_payment(payment_intent_id)
```