import { Duration, Stack } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

// export interface CdnProps {
//     logsBucket: IBucket;
//     defaultOrigin: IOrigin;
// }

export class Eventbus extends Construct {
    public readonly eventbus: events.EventBus;

    constructor(scope: Construct, id: string) {
        // , props: CdnProps) {
        super(scope, id);

        //  Event Bus locked to this account
        const bus = new events.EventBus(this, 'bus', {
            // eventBusName: 'MyCustomEventBus',
        });

        bus.archive('MyArchive', {
            // archiveName: 'MyCustomEventBusArchive',
            // description: 'MyCustomerEventBus Archive',
            eventPattern: {
                account: [Stack.of(this).account],
            },
            retention: Duration.days(15),
        });

        this.eventbus = bus;
    }
}
