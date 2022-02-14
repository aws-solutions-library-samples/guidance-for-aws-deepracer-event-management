

import React, { Component } from 'react';
import { API } from 'aws-amplify';
import { Container, Header, Table, Checkbox, } from 'semantic-ui-react';

import CarModelUploadModal from "./carModelUploadModal.js";
//import { ConsoleLogger } from '@aws-amplify/core';

//const path = require('path')
class AdminModels extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      percent: 0,
      result: '',
      filename: '',
      models: [],
      modelsToUpload: [],
      cars: [],
      view: 'list',
      username: '',
    };
  }

  componentDidMount = async () => {
    // Cars
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

    let cars = await getCars();
    this.setState({ cars: cars })
    //console.log(cars);
    
    // Models
    async function getModels(outerThis) {
      const apiName = 'deepracerEventManager';
      const apiPath = 'models';
    
      let models = await API.get(apiName, apiPath);
      //console.log(models)
      outerThis.setState({ models: models });
    }
    
    // Collect Car data
    this.setState({ files: [] })

    // Collect Models
    getModels(this);

    this._isMounted = true;
  }

  getCheckBoxState(model) {
    let modelChecked = false;
    for (const currentModel in this.state.modelsToUpload) {
      if (this.state.modelsToUpload[currentModel].Key === model.Key) {
        modelChecked = true;
      }
    }
    return modelChecked;
  }
  
  onCheckBoxChange(checked, cars, model) {
    //console.log(event)
    //console.log(checked)
    //console.log(cars)
    //console.log(model)

    let tempModelsToUpload = this.state.modelsToUpload
    if(checked){
      tempModelsToUpload.push(model)
    }
    else if (!checked){
      //console.log('remove')
      tempModelsToUpload = []
      for (const currentModel in this.state.modelsToUpload) {
        // console.log(this.state.modelsToUpload[currentModel].Key);
        // console.log(model.Key)
        // Don't add key back to array that was just unticked
        if (this.state.modelsToUpload[currentModel].Key !== model.Key) {
          tempModelsToUpload.push(this.state.modelsToUpload[currentModel])
        }
      }
    }

    this.setState({modelsToUpload: tempModelsToUpload})
    //console.log(this.state.modelsToUpload)
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    let tablerows = this.state.models.map(function (model, i) {
      const modelKeyPieces = (model.Key.split('/'));
      let modelUser = modelKeyPieces[modelKeyPieces.length - 3];
      let modelName = modelKeyPieces[modelKeyPieces.length - 1];
      return <Table.Row key={i} >
        <Table.Cell>{modelUser} </Table.Cell>
        <Table.Cell>{modelName} </Table.Cell>
        <Table.Cell><Checkbox checked={this.getCheckBoxState(model)} onChange={(event, data) => this.onCheckBoxChange(data.checked, this.state.cars, model)} /></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''
    
    if (this.state.view === 'list'){
      content = <Table celled striped>
      <Table.Header>
          <Table.Row>
            <Table.HeaderCell>User</Table.HeaderCell>
            <Table.HeaderCell>Model</Table.HeaderCell>
            <Table.HeaderCell>Upload to Car</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tablerows}
        </Table.Body>
      </Table>
    }
    


    return (
      <div>
      <Header as='h1' icon textAlign='center'>Admin Models</Header>
      {content}
      <Container textAlign='center'>
        <CarModelUploadModal cars={this.state.cars} models={this.state.modelsToUpload} />
      </Container>
    </div>
    )
  }
}

export {AdminModels}