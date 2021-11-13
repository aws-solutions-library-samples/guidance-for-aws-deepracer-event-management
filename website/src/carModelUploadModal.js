import React from 'react'
import { API } from 'aws-amplify';
import { Table, Button, Modal, Radio } from 'semantic-ui-react'

async function getCars() {
  console.log("Collecting cars...")

  const apiName = 'deepracerEventManager';
  const apiPath = 'cars';
  // const myInit = { 
  //   body: {
  //     key: clickitem['key']
  //   }
  // };

  let response = await API.get(apiName, apiPath);
  //let response = await API.post(apiName, apiPath, myInit);
  //console.log(response)
  return response
}

function CarModelUploadModal(cars) {
  const [open, setOpen] = React.useState(false)

  //let cars = collectCars()
  //let cars = [];
  console.log(cars.cars);

  var modaltablerows = cars.cars.map(function (item, i) {
    return <Table.Row key={i} >
      <Table.Cell>{item.ComputerName} </Table.Cell>
      <Table.Cell><Radio></Radio> </Table.Cell>
    </Table.Row>
  });

  return (
    
    <Modal
      
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      trigger={<Button positive circular icon='upload' />}
    >
      <Modal.Header>Select a Car</Modal.Header>
      <Modal.Content>
        <p>
          Pick a car
        </p>
        <Table>
          <Table.Body>
            {modaltablerows}
          </Table.Body>
        </Table>
      </Modal.Content>
      <Modal.Actions>
        <Button color='red' onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          content="Upload"
          labelPosition='right'
          icon='upload'
          onClick={() => setOpen(false)}
          positive
        />
      </Modal.Actions>
    </Modal>
  )
}

export default CarModelUploadModal
