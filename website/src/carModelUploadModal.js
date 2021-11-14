import React, { Component } from 'react';
import { API } from 'aws-amplify';
import { Table, Button, Modal } from 'semantic-ui-react'


class CarModelUploadModal extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      open: false,
      resultOpen: false,
      result: "",
    };
  }

  componentDidMount = async () => {
    this.setState({ result: <p>Mounted</p> })
  }

  uploadModelToCar= async (car, model) => { 
    console.log(car.InstanceId)
    console.log(model.key)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload';
    const myInit = { 
      body: {
        InstanceId: car.InstanceId,
        key: model.key
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    console.log(response)
    this.setState({ result: response });
    return response
  }

  render(){
    //let cars = collectCars()
    //let cars = [];
    //console.log(cars.cars);
    //console.log('model')
    //console.log(props.model)

    var modaltablerows = this.props.cars.map(function (car, i) {
      return <Table.Row key={i} >
        <Table.Cell>{car.ComputerName} </Table.Cell>
        <Table.Cell><Button content="Upload" labelPosition='right' icon='upload' onClick={() => {
          this.setState({ result: <p>Uploading...</p> });
          this.setState({ open: false });
          this.setState({ resultOpen: true }); 
          this.uploadModelToCar(car, this.props.model) 
          }} positive /></Table.Cell>
      </Table.Row>
    }.bind(this));

    return (
      <>
        <Modal
          onClose={() => this.setState({ open: false })}
          onOpen={() => this.setState({ open: true })}
          open={this.state.open}
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
            <Button color='red' onClick={() => {
              this.setState({ open: false }); 
              this.setState({ result: "" });
            }}>Close</Button>
          </Modal.Actions>
        </Modal>

        <Modal
        onClose={() => this.setState({ resultOpen: false })}
        onOpen={() => this.setState({ resultOpen: true })}
        open={this.state.resultOpen}
        >
        <Modal.Header>Upload Result</Modal.Header>
        <Modal.Content>
          <p>
            {this.state.result}
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button color='red' onClick={() => {
            this.setState({ resultOpen: false }); 
            this.setState({ result: "" });
          }}>Close</Button>
        </Modal.Actions>
        </Modal>
      </>
    )
  }
}

export default CarModelUploadModal
