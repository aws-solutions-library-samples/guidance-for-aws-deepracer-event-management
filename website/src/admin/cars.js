
import React from 'react';
import { Header, Image } from 'semantic-ui-react';

const AdminCars = () => {
  //const [count, setCount] = React.useState(0); // state
 
  return (
    <div>
      <Header as='h1' icon textAlign='center'>Admin Cars</Header>
      <Image alt="DeepRacer Logo" src="/logo-bw.png" size='large' centered />
    </div>
  );
 };

export {AdminCars}