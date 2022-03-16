

import React, { Component } from 'react';
import { Auth, Storage } from 'aws-amplify';
import { Table, Button } from 'semantic-ui-react';

//import CarModelUploadModal from "./carModelUploadModal.js";
//import { ConsoleLogger } from '@aws-amplify/core';

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
      view: 'list',
      username: '',
    };
  }

  componentDidMount = async () => {
    // Models
    async function getModels(outerThis) {
      // get user's username
      Auth.currentAuthenticatedUser().then(user => {
        //console.log(user)
        const username = user.username;
        const s3Path = username + "/models";
        console.log("s3Path: " + s3Path);
        Storage.list(s3Path, { level: 'private' }).then(models => {
          console.log(models)
          if(models !== undefined){
            outerThis.setState({ models: models });
          }
        })
      })
    }

    // Collect Car data
    this.setState({ files: [] })

    // Collect Models
    getModels(this);

    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  onDeleteClickHandler = async(clickitem) => {
    async function deleteImage(key) {
      return await Storage.remove(key, { level: 'private' })
    }

    console.log(clickitem['key'])

    let response = await deleteImage(clickitem['key'])
    console.log(response)

    this.componentDidMount()
  }

  render() {
    var tablerows = this.state.models.map(function (model, i) {
      const modelKeyPieces = (model.key.split('/'))
      var modelName = modelKeyPieces[modelKeyPieces.length - 1]
      return <Table.Row key={i} >
        <Table.Cell>{modelName} </Table.Cell>
        <Table.Cell><Button negative circular icon='delete' onClick={(event) => this.onDeleteClickHandler(model)}/></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''

    if (this.state.view === 'list'){
      content = <Table celled striped>
      <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
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
        <p><b>Note:</b> Models are only kept for 15 days from initial upload before being removed.</p>
        {content}
      </div>
    )
  }
}

export {Models}
