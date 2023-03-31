# Cognito + SES

In the default configuration Cognito only supports 50 signups a day due to a hard limit on the number of signup emails it is allowed to send. To resolve this you must enable the [integration with SES](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

To manually enable this integration, you can follow these rough steps:
1. `Purchase/Register` your domain in `Route 53 `
    * you can use other DNS providers but those steps are not detailed here
2. `Add the domain` to the verified identities in `Amazon SES`
3. Take the SES account out of [sandbox mode](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
4. Navigate to your `Amazon Cognito User Pool`
5. Click `Edit` in `Messaging, Email`
6. Switch the configuration to `Send email with Amazon SES` and complete the rest of the email configuration appropriately 
7. Click `Save changes`