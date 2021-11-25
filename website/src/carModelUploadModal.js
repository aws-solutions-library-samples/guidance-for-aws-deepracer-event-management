import React, { Component } from 'react';
import { API } from 'aws-amplify';
import { Message, Icon, Dimmer, Loader, Header, Table, Button, Modal } from 'semantic-ui-react'

class CarModelUploadModal extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      open: false,
      resultOpen: false,
      result: "",
      CurrentInstanceId: "",
      CommandId: "",
      uploadStatus: "",
      count: 0,
      delay: 1000,
      dimmerActive: false,
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
    this.setState({ CommandId: response });
    this.setState({ CurrentInstanceId: car.InstanceId });
    this.setState({ uploadStatus: "InProgress" });
    this.setState({ dimmerActive: true });
    this.interval = setInterval(this.tick, this.state.delay); // start poll
    return response
  }

  uploadModelToCarStatus= async (InstanceId, CommandId) => { 
    console.log(InstanceId)
    console.log(CommandId)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload/status';
    const myInit = { 
      body: {
        InstanceId: InstanceId,
        CommandId: CommandId
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    console.log(response)
    this.setState({ result: response });
    this.setState({ uploadStatus: response });
    return response
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  // this is the function that is polling
  tick = () => {
    this.setState({
      count: this.state.count + 1
    });
    console.log(this.state.count)
    this.uploadModelToCarStatus(this.state.CurrentInstanceId, this.state.CommandId);
    if (this.state.uploadStatus !== "InProgress"){
      console.log(this.state.uploadStatus + " !== InProgress")
      clearInterval(this.interval); // stop poll
      this.setState({ dimmerActive: false });
    }
  }

  render(){
    //let cars = collectCars()
    //let cars = [];
    //console.log(cars.cars);
    //console.log('model')
    //console.log(props.model)
    console.log(this.props.cars.length)

    var modaltable = <Message negative icon>
      <Icon name='exclamation' />
      <Message.Header>No DeepRacer cars are online</Message.Header>
    </Message>

    if (this.props.cars.length > 0){
      modaltable = this.props.cars.map(function (car, i) {
        return <Table>
          <Table.Body>
            <Table.Row key={i} >
              <Table.Cell textAlign='left'><Header as='h3'>{car.ComputerName}</Header></Table.Cell>
              <Table.Cell textAlign='right'><Button content="Upload" labelPosition='right' icon='upload' onClick={() => {
                this.setState({ result: <p>Submitting Job...</p> });
                this.setState({ open: false });
                this.setState({ resultOpen: true }); 
                this.uploadModelToCar(car, this.props.model);
                }} positive /></Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      }.bind(this));
    }

    var resultModalContent = ""
    if (this.state.dimmerActive) {
      resultModalContent = 
        <Dimmer active inverted>
          <Loader size='large'>{this.state.result}</Loader>
        </Dimmer>
    }
    else{
      resultModalContent = 
        <Header as='h3' textAlign='center'>{this.state.result}</Header>
    }

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
            {modaltable}
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
          {resultModalContent}
        </Modal.Content>
        <Modal.Actions>
          <Button color='red' onClick={() => {
            this.setState({ resultOpen: false }); 
            this.setState({ result: "" });
            clearInterval(this.interval); // stop poll
          }}>Close</Button>
        </Modal.Actions>
        </Modal>
      </>
    )
  }
}

export default CarModelUploadModal
