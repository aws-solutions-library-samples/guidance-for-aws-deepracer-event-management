import React, { Component } from 'react';
import { API } from 'aws-amplify';
import { Label, Message, Icon, Dimmer, Loader, Header, Table, Button, Modal, Container } from 'semantic-ui-react'

class CarModelUploadModal extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      open: false,
      resultOpen: false,
      result: "",
      results: [],
      CurrentInstanceId: "",
      CurrentModel: "",
      CommandId: "",
      uploadStatus: "",
      count: 0,
      delay: 1000,
      dimmerActive: false,
      uploadButtonDisabled: true,
    };
  }

  componentDidMount = async () => {
    this.setState({ result: <p>Mounted</p> })
  }

  startModelUploadsToCar = async (car, models) => {
    this.setState({
      car: car,
      models: models,
    })
    this.interval = setInterval(this.startModelUploadsToCarTick, this.state.delay); // start poll
  }

  startModelUploadsToCarTick = () => {
    let models = this.state.models
    this.setState({
      count: this.state.count + 1
    });

    //console.log('Models in array: ' + models.length)
    if (this.state.uploadStatus !== "InProgress"){
      this.setState({ 
        uploadStatus: "InProgress",
      });
      //console.log(this.state.uploadStatus + " !== InProgress")
      if(models.length > 0) {
        let model = models.pop();
        //console.log('POP!');
        this.uploadModelToCar(this.state.car, model);
      }
      else {
        clearInterval(this.interval); // stop poll
        this.setState({ dimmerActive: false });
      }      
    } else {
      this.uploadModelToCarStatus(this.state.CurrentInstanceId, this.state.CommandId, this.state.CurrentModel);
    }
  }

  uploadModelToCar= async (car, model) => { 
    //console.log(car.InstanceId)
    //console.log(model.Key)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload';
    const myInit = { 
      body: {
        InstanceId: car.InstanceId,
        key: model.Key
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    //console.log(response)
    this.setState({ 
      result: response,
      CommandId: response,
      CurrentInstanceId: car.InstanceId,
      CurrentModel: model,
      uploadStatus: "InProgress",
      dimmerActive: true, 
    });
  }

  uploadModelToCarStatus= async (InstanceId, CommandId, model) => { 
    //console.log(InstanceId)
    //console.log(CommandId)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload/status';
    const myInit = { 
      body: {
        InstanceId: InstanceId,
        CommandId: CommandId
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    //console.log(response)

    const modelKeyPieces = (model.Key.split('/'));
    let modelUser = modelKeyPieces[modelKeyPieces.length - 3];
    let modelName = modelKeyPieces[modelKeyPieces.length - 1];

    let resultToAdd = {"ModelName": (modelUser + '-' + modelName), "CommandId": CommandId, "Status": response};
    let tempResultsArray = [];
    //console.log(resultToAdd);

    let updatedElement = false;
    for (const currentResult in this.state.results) {
      if (this.state.results[currentResult].CommandId === CommandId) {
        //console.log('update');
        tempResultsArray.push(resultToAdd);
        updatedElement = true;
      } else {
        //console.log('dont update');
        tempResultsArray.push(this.state.results[currentResult])
      }
    };

    // if result hasn't been updated because it doesn't exist, add the element
    if(!updatedElement) {
      tempResultsArray.push(resultToAdd)
    };

    this.setState({ 
      result: response,
      uploadStatus: response,
      results: tempResultsArray
    });
    return response;
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render(){
    //let cars = collectCars()
    //let cars = [];
    //console.log(cars.cars);
    //console.log('model')
    //console.log(this.props.models.length)
    //console.log(this.props.cars.length)


    //enable/disable upload button
    let uploadButtonDisabled = true
    if (this.props.models.length > 0) {
      uploadButtonDisabled = false;
    } else {
      uploadButtonDisabled = true;
    }

    // default modal when no cars are online
    var modaltable = <Message negative icon>
      <Icon name='exclamation' />
      <Message.Header>No DeepRacer cars are online</Message.Header>
    </Message>

    // if cars are online, display the car picker modal
    if (this.props.cars.length > 0){
      modaltable = this.props.cars.map(function (car, i) {
        return <Table>
          <Table.Body>
            <Table.Row key={i} >
              <Table.Cell textAlign='left'><Header as='h3'>{car.ComputerName}</Header></Table.Cell>
              <Table.Cell textAlign='right'><Button content="Upload" labelPosition='right' icon='upload' onClick={() => {
                this.setState({ 
                  result: <p>Submitting Job...</p>,
                  open: false,
                  resultOpen: true,
                  results: [], 
                });
                this.startModelUploadsToCar(car, this.props.models);
                }} positive /></Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      }.bind(this));
    }

    let resultRows = this.state.results.map(function (result, i) {
      return <Table>
        <Table.Body>
          <Table.Row key={i} >
            <Table.Cell textAlign='left'>{result.ModelName} </Table.Cell>
            <Table.Cell textAlign='center'>{result.CommandId} </Table.Cell>
            <Table.Cell textAlign='right'>{result.Status} </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    });

    var resultModalContent = ""
    if (this.state.dimmerActive) {
      resultModalContent = 
        <Container>
          {resultRows}
          <Dimmer active inverted>
            <Loader size='large'>{this.state.result}</Loader>
          </Dimmer>
        </Container>    
    }
    else{
      resultModalContent = <Container>
        {resultRows}
      </Container>
    }

    return (
      <>
        <Modal
          onClose={() => this.setState({ open: false })}
          onOpen={() => this.setState({ open: true })}
          open={this.state.open}
          trigger={
            // <Button content="Upload" labelPosition='left' positive icon='upload' />
            <Button as='div' labelPosition='right' disabled={uploadButtonDisabled}>
              <Button icon positive>
                <Icon name='upload' />
                Upload
              </Button>
              <Label as='a' basic pointing='left'>
                {this.props.models.length}
              </Label>
            </Button>
          }
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
