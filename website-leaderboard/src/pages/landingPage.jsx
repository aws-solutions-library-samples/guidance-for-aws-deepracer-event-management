import { Link } from '@cloudscape-design/components';
import Box from '@cloudscape-design/components/box';
import Cards from '@cloudscape-design/components/cards';
import * as React from 'react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../assets/logo512.png';
import awsconfig from '../config.json';
import styles from './landingPage.module.css';


export function LandingPage() {
  const urlParams = useParams();
  const eventId = urlParams.eventId;
  console.log(eventId);

  // let language = queryParams.get('lang');
  // if (language === null) language = 'en';
  //
  // let trackId = queryParams.get('track');
  // if (trackId === null) trackId = 1;

  const defaultPageItems = [
    {
      linkName: "Follow the race live!",
      linkDescription: "View the DeepRacer Leaderboard live.",
      linkHref: `${window.location.origin}/leaderboard/${eventId}`,
    },
    {
      linkName: 'About DeepRacer',
      linkDescription: 'Get to know more about AWS DeepRacer.',
      linkHref: 'https://aws.amazon.com/deepracer',
    },
    {
      linkName: 'Upload your own model and race',
      linkDescription: 'Upload your own autonomous racing model here and get started racing!',
      linkHref: awsconfig.Urls.drem,
    },
  ]


  const [landingPageItems, setLandingPageItems] = useState(defaultPageItems);

  // useEffect(() => {
  //   API.graphql({
  //     query: queries.getLandingPageConfig,
  //     variables: { eventId: eventId },
  //   }).then(
  //     (item) => {
  //       setLandingPageItems([...defaultPageItems, ...item.data.getLandingPageConfig.links]);
  //     },
  //   );
  // }, [eventId]);


  return (
    <div
      className={styles.landingPageRoot} >

      <div className={styles.logodiv}>
        <img src={Logo} alt="DeepRacer Logo" className={styles.logo} />
      </div>

      <div className={styles.landingPageCards}>
        <Cards
          ariaLabels={{
            itemSelectionLabel: (e, n) => `select ${n.name}`,
            selectionGroupLabel: 'Item selection',
          }}
          cardDefinition={{
            header: item => (
              <Link
                external
                externalIconAriaLabel='Opens in new tab'
                href={item.linkHref}
              >
                {item.linkName}
              </Link>
            ),
            sections: [
              {
                id: 'description',
                header: 'Description',
                content: item => item.linkDescription,
              },
            ],
          }}
          cardsPerRow={[{ cards: 1 }]}
          items={landingPageItems}
          loadingText='Loading resources'
          empty={
            <Box textAlign='center' color='inherit'>
              <b>No resources</b>
              <Box
                padding={{ bottom: 's' }}
                variant='p'
                color='inherit'
              >
                No resources to display.
              </Box>
            </Box>
          }
        />
      </div>
    </div>

  );

}
