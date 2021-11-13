

import React, { Component } from 'react';
import { Storage, API } from 'aws-amplify';
import { Table, Button } from 'semantic-ui-react';

import CarModelUploadModal from "./carModelUploadModal.js";

//const path = require('path')
class Models extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      percent: 0,
      result: '',
      filename: '',
      models: [],
      cars: [],
      view: 'list',
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
    console.log(cars);
    
    // Models
    async function getModels() { 
      return await Storage.list('models/uploaded/', { level: 'public' })
    }
    
    // Collect Image data
    this.setState({ files: [] })
    let models = await getModels();
    console.log(models);
    this.setState({ models: models })
    // let enhancedArrayedResult = [];
    // models.forEach(element => {
    //   let thumbnailKey = path.relative('/public', element.thumbnailKey);
    //   let presignedurl = Storage.get(thumbnailKey)
    //   presignedurl.then(url => {
    //     element.presignedurl = url
    //     enhancedArrayedResult = this.state.files
    //     enhancedArrayedResult.push(element)
    //     this.setState({ files: enhancedArrayedResult })
    //     //console.log(element)
    //   })
    // })

    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onDeleteClickHandler = async(clickitem) => {
    async function deleteImage(key) { 
      return await Storage.remove(key)
    }

    console.log(clickitem['key'])

    let response = await deleteImage(clickitem['key'])
    console.log(response)

    this.componentDidMount()
  }

  // onUploadClickHandler = async(clickitem) => {
  //   console.log("Upload to Car " + clickitem['key'])

  //   const apiName = 'deepracerEventManager';
  //   const apiPath = 'cars';
  //   // const myInit = { 
  //   //   body: {
  //   //     key: clickitem['key']
  //   //   }
  //   // };

  //   let response = await API.get(apiName, apiPath);
  //   //let response = await API.post(apiName, apiPath, myInit);
  //   console.log(response)

  //   this.componentDidMount()
  // }

  //
  render() {
    var tablerows = this.state.models.map(function (model, i) {
      return <Table.Row key={i} >
        <Table.Cell>{model.key} </Table.Cell>
        <Table.Cell><CarModelUploadModal cars={this.state.cars} model={model} /></Table.Cell>
        <Table.Cell><Button negative circular icon='delete' onClick={(event) => this.onDeleteClickHandler(model)}/></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''
    
    if (this.state.view === 'list'){
      content = <Table celled striped>
      <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Upload to Car</Table.HeaderCell>
            <Table.HeaderCell>Delete</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tablerows}
        </Table.Body>
      </Table>
    }
    


    return (
      <div>
      {content}
    </div>
    )
  }
}

export {Models}